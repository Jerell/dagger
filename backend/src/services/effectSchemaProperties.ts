import * as path from "path";
import * as fs from "fs/promises";
import {
  getSchemaMetadata,
  listSchemaSets,
  listBlockTypes,
} from "./effectSchemas";
import { getDagger } from "../utils/getDagger";

function resolvePath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

async function readNetworkFiles(networkPath: string): Promise<{
  files: Record<string, string>;
  configContent: string | null;
}> {
  const absolutePath = resolvePath(networkPath);
  const entries = await fs.readdir(absolutePath, { withFileTypes: true });

  const files: Record<string, string> = {};
  let configContent: string | null = null;

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".toml")) {
      const filePath = path.join(absolutePath, entry.name);
      const content = await fs.readFile(filePath, "utf-8");
      files[entry.name] = content;

      if (entry.name === "config.toml") {
        configContent = content;
      }
    }
  }

  return { files, configContent };
}

/**
 * Get schema properties for blocks matching a query path
 * Returns flattened format: { "branch-1/blocks/0/length": { dimension, defaultUnit, title, ... } }
 */
export async function getBlockSchemaProperties(
  networkPath: string,
  query: string,
  schemaSet: string,
): Promise<Record<string, any>> {
  const dagger = getDagger();
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  // Execute query to get blocks
  const queryResult = dagger.query_from_files(
    filesJson,
    configContent || undefined,
    query,
  );
  const blocks = JSON.parse(queryResult);

  // If query result is a single block, wrap it
  const blocksArray = Array.isArray(blocks) ? blocks : [blocks];

  const result: Record<string, any> = {};

  // Extract block paths from query
  // For queries like "branch-1/blocks/0", the path is the query itself
  // For queries like "branch-1/blocks" or "branch-1/blocks[type=Compressor]", we need to iterate
  // First, get the base path by removing filters
  let basePath = query;
  const filterMatch = query.match(/^(.+?)\[.+\]$/);
  if (filterMatch) {
    basePath = filterMatch[1];
  }

  // If the query is for blocks (with or without filter), we need to get the original blocks
  // to determine the correct indices for the filtered results
  if (basePath.endsWith("/blocks")) {
    // Get all blocks to determine original indices
    const allBlocksQuery = dagger.query_from_files(
      filesJson,
      configContent || undefined,
      basePath,
    );
    const allBlocks = JSON.parse(allBlocksQuery);
    const allBlocksArray = Array.isArray(allBlocks) ? allBlocks : [allBlocks];

    // Query for all blocks in a branch (filtered or not)
    for (let i = 0; i < blocksArray.length; i++) {
      const block = blocksArray[i];
      if (!block || typeof block !== "object" || !block.type) {
        continue;
      }

      // Find the original index of this block in the unfiltered array
      // Match by type and other identifying properties
      let originalIndex = -1;
      for (let j = 0; j < allBlocksArray.length; j++) {
        const origBlock = allBlocksArray[j];
        if (
          origBlock &&
          typeof origBlock === "object" &&
          origBlock.type === block.type
        ) {
          // Check if this is the same block by comparing key properties
          let matches = true;
          for (const key of Object.keys(block)) {
            if (key !== "type" && origBlock[key] !== block[key]) {
              matches = false;
              break;
            }
          }
          if (matches) {
            // Check if we've already used this index
            let alreadyUsed = false;
            for (let k = 0; k < i; k++) {
              const prevBlock = blocksArray[k];
              if (
                prevBlock &&
                typeof prevBlock === "object" &&
                prevBlock.type === origBlock.type
              ) {
                let prevMatches = true;
                for (const key of Object.keys(prevBlock)) {
                  if (key !== "type" && origBlock[key] !== prevBlock[key]) {
                    prevMatches = false;
                    break;
                  }
                }
                if (prevMatches) {
                  alreadyUsed = true;
                  break;
                }
              }
            }
            if (!alreadyUsed) {
              originalIndex = j;
              break;
            }
          }
        }
      }

      // If we couldn't find the original index, use the filtered index
      // This can happen if blocks are identical
      const blockIndex = originalIndex >= 0 ? originalIndex : i;
      const blockPath = `${basePath}/${blockIndex}`;
      const blockType = block.type;
      const schemaMetadata = getSchemaMetadata(schemaSet, blockType);

      if (schemaMetadata) {
        // Add all properties for this block
        for (const [propName, propMetadata] of Object.entries(
          schemaMetadata.properties,
        )) {
          const propertyPath = `${blockPath}/${propName}`;
          const isRequired = schemaMetadata.required.includes(propName);
          result[propertyPath] = {
            block_type: blockType,
            property: propName,
            required: isRequired,
            title: propMetadata.title,
            dimension: propMetadata.dimension,
            defaultUnit: propMetadata.defaultUnit,
            min: propMetadata.min,
            max: propMetadata.max,
          };
        }
      }
    }
  } else if (query.includes("/blocks/")) {
    // Query for a specific block
    const block = blocksArray[0];
    if (block && typeof block === "object" && block.type) {
      const blockType = block.type;
      const schemaMetadata = getSchemaMetadata(schemaSet, blockType);

      if (schemaMetadata) {
        // Add all properties for this block
        for (const [propName, propMetadata] of Object.entries(
          schemaMetadata.properties,
        )) {
          const propertyPath = `${query}/${propName}`;
          const isRequired = schemaMetadata.required.includes(propName);
          result[propertyPath] = {
            block_type: blockType,
            property: propName,
            required: isRequired,
            title: propMetadata.title,
            dimension: propMetadata.dimension,
            defaultUnit: propMetadata.defaultUnit,
            min: propMetadata.min,
            max: propMetadata.max,
          };
        }
      }
    }
  }

  return result;
}

/**
 * Get schema properties for all blocks in a network
 * Returns flattened format: { "branch-1/blocks/0/length": { dimension, defaultUnit, title, ... } }
 */
export async function getNetworkSchemas(
  networkPath: string,
  schemaSet: string,
): Promise<Record<string, any>> {
  const wasm = getDagger();
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  const result: Record<string, any> = {};

  // Query for all nodes and filter for branches
  try {
    const nodesQuery = wasm.query_from_files(
      filesJson,
      configContent || undefined,
      "network/nodes",
    );
    const nodes = JSON.parse(nodesQuery);
    const nodesArray = Array.isArray(nodes) ? nodes : [nodes];

    // Filter for branch nodes (type is "branch" from TOML)
    const branches = nodesArray.filter(
      (node: any) => node && typeof node === "object" && node.type === "branch",
    );

    for (const branch of branches) {
      if (!branch || typeof branch !== "object" || !branch.id) {
        continue;
      }

      const branchId = branch.id;
      // Query for blocks in this branch
      const branchBlocksQuery = wasm.query_from_files(
        filesJson,
        configContent || undefined,
        `${branchId}/blocks`,
      );
      const branchBlocks = JSON.parse(branchBlocksQuery);
      const branchBlocksArray = Array.isArray(branchBlocks)
        ? branchBlocks
        : [branchBlocks];

      for (let i = 0; i < branchBlocksArray.length; i++) {
        const block = branchBlocksArray[i];
        if (!block || typeof block !== "object" || !block.type) {
          continue;
        }

        const blockPath = `${branchId}/blocks/${i}`;
        const blockType = block.type;
        const schemaMetadata = getSchemaMetadata(schemaSet, blockType);

        if (schemaMetadata) {
          // Add all properties for this block
          for (const [propName, propMetadata] of Object.entries(
            schemaMetadata.properties,
          )) {
            const propertyPath = `${blockPath}/${propName}`;
            const isRequired = schemaMetadata.required.includes(propName);
            result[propertyPath] = {
              block_type: blockType,
              property: propName,
              required: isRequired,
              title: propMetadata.title,
              dimension: propMetadata.dimension,
              defaultUnit: propMetadata.defaultUnit,
              min: propMetadata.min,
              max: propMetadata.max,
            };
          }
        }
      }
    }
  } catch (error) {
    console.warn("Failed to query network nodes for network schemas", error);
  }

  return result;
}

/**
 * Get all available schema sets
 */
export function getSchemas(): string[] {
  return listSchemaSets();
}

/**
 * Get schemas for a specific schema set
 */
export function getSchema(schemaSet: string): Record<string, any> {
  const blockTypes = listBlockTypes(schemaSet);
  const result: Record<string, any> = {};

  for (const blockType of blockTypes) {
    const schemaMetadata = getSchemaMetadata(schemaSet, blockType);
    if (schemaMetadata) {
      result[blockType] = {
        block_type: blockType,
        version: schemaSet,
        required: schemaMetadata.required,
        optional: schemaMetadata.optional,
        properties: schemaMetadata.properties,
      };
    }
  }

  return result;
}
