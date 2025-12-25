import { DaggerWasm } from "../../pkg/dagger.js";
import * as path from "path";
import * as fs from "fs/promises";
import {
  getSchemaMetadata,
  listSchemaSets,
  listBlockTypes,
} from "./effectSchemas.js";

// With nodejs target, WASM is initialized synchronously when module loads
let daggerWasm: DaggerWasm | null = null;

function getWasm() {
  if (!daggerWasm) {
    daggerWasm = new DaggerWasm();
  }
  return daggerWasm;
}

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
  schemaSet: string
): Promise<Record<string, any>> {
  const wasm = getWasm();
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  // Execute query to get blocks
  const queryResult = wasm.query_from_files(
    filesJson,
    configContent || undefined,
    query
  );
  const blocks = JSON.parse(queryResult);

  // If query result is a single block, wrap it
  const blocksArray = Array.isArray(blocks) ? blocks : [blocks];

  const result: Record<string, any> = {};

  // Extract block paths from query
  // For queries like "branch-1/blocks/0", the path is the query itself
  // For queries like "branch-1/blocks", we need to iterate
  let basePath = query;
  if (query.endsWith("/blocks")) {
    // Query for all blocks in a branch
    for (let i = 0; i < blocksArray.length; i++) {
      const block = blocksArray[i];
      if (!block || typeof block !== "object" || !block.type) {
        continue;
      }

      const blockPath = `${basePath}/${i}`;
      const blockType = block.type;
      const schemaMetadata = getSchemaMetadata(schemaSet, blockType);

      if (schemaMetadata) {
        // Add all properties for this block
        for (const [propName, propMetadata] of Object.entries(
          schemaMetadata.properties
        )) {
          const propertyPath = `${blockPath}/${propName}`;
          result[propertyPath] = {
            dimension: propMetadata.dimension,
            defaultUnit: propMetadata.defaultUnit,
            title: propMetadata.title,
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
          schemaMetadata.properties
        )) {
          const propertyPath = `${query}/${propName}`;
          result[propertyPath] = {
            dimension: propMetadata.dimension,
            defaultUnit: propMetadata.defaultUnit,
            title: propMetadata.title,
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
  schemaSet: string
): Promise<Record<string, any>> {
  const wasm = getWasm();
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  const result: Record<string, any> = {};

  // Query for all branches
  try {
    const branchesQuery = wasm.query_from_files(
      filesJson,
      configContent || undefined,
      "branches"
    );
    const branches = JSON.parse(branchesQuery);
    const branchesArray = Array.isArray(branches) ? branches : [branches];

    for (const branch of branchesArray) {
      if (!branch || typeof branch !== "object" || !branch.id) {
        continue;
      }

      const branchId = branch.id;
      // Query for blocks in this branch
      const branchBlocksQuery = wasm.query_from_files(
        filesJson,
        configContent || undefined,
        `${branchId}/blocks`
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
            schemaMetadata.properties
          )) {
            const propertyPath = `${blockPath}/${propName}`;
            result[propertyPath] = {
              dimension: propMetadata.dimension,
              defaultUnit: propMetadata.defaultUnit,
              title: propMetadata.title,
              min: propMetadata.min,
              max: propMetadata.max,
            };
          }
        }
      }
    }
  } catch (error) {
    console.warn("Failed to query branches for network schemas", error);
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

