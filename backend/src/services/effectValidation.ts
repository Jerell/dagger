import { Schema, Either } from "effect";
import { DaggerWasm } from "../../pkg/dagger.js";
import * as path from "path";
import * as fs from "fs/promises";
import {
  getSchema,
  getSchemaMetadata,
  getPropertyConstraints,
  PropertyMetadata,
} from "./effectSchemas.js";
import { formatValue, UnitPreferences } from "./unitFormatter.js";
import { parseUnitPreferences } from "./query.js";
import dim from "./dim.js";

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

interface NetworkFiles {
  files: Record<string, string>;
  configContent: string | null;
}

async function readNetworkFiles(networkPath: string): Promise<NetworkFiles> {
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

export interface ValidationResult {
  is_valid: boolean;
  severity?: "error" | "warning";
  message?: string;
  value?: string;
  scope?: string;
}

/**
 * Validate a block directly without network context (for POST /api/schema/validate)
 */
export async function validateBlockDirect(
  block: any,
  blockType: string,
  schemaSet: string
): Promise<Record<string, ValidationResult>> {
  const schema = getSchema(schemaSet, blockType);
  if (!schema) {
    return {
      [`${blockType}/_schema`]: {
        is_valid: false,
        severity: "error",
        message: `Schema not found for block type '${blockType}' in schema set '${schemaSet}'`,
      },
    };
  }

  // Get schema metadata
  const schemaMetadata = getSchemaMetadata(schemaSet, blockType);
  if (!schemaMetadata) {
    return {
      [`${blockType}/_schema`]: {
        is_valid: false,
        severity: "error",
        message: `Could not extract metadata for block type '${blockType}'`,
      },
    };
  }

  const results: Record<string, ValidationResult> = {};

  // Validate using Effect Schema
  const validationResult = Schema.decodeUnknownEither(schema)(block);

  // Get all properties from schema (required + optional)
  const allProperties = [
    ...schemaMetadata.required,
    ...schemaMetadata.optional,
  ];

  // Check each property
  for (const propertyName of allProperties) {
    const propertyPath = `${blockType}/${propertyName}`;

    // Check if property is required and missing
    const isRequired = schemaMetadata.required.includes(propertyName);
    const hasValue = block[propertyName] !== undefined && block[propertyName] !== null;

    if (isRequired && !hasValue) {
      results[propertyPath] = {
        is_valid: false,
        severity: "error",
        message: `Required property '${propertyName}' is missing for block type '${blockType}'`,
      };
      continue;
    }

    // Check Effect Schema validation errors for this property
    if (Either.isLeft(validationResult)) {
      const errors = validationResult.left;
      const errorMessage = String(errors);
      if (errorMessage.includes(propertyName)) {
        results[propertyPath] = {
          is_valid: false,
          severity: "error",
          message: `Validation error for property '${propertyName}': ${errorMessage}`,
        };
        continue;
      }
    }

    // Property is valid
    if (hasValue) {
      results[propertyPath] = {
        is_valid: true,
      };
    } else {
      // Optional and not present - valid
      results[propertyPath] = {
        is_valid: true,
      };
    }
  }

  return results;
}

/**
 * Helper to extract block path from query string
 * e.g., "branch-1/blocks/0" -> "branch-1/blocks/0"
 */
function extractBlockPathFromQuery(query: string, blockIndex?: number): string {
  // If query already points to a specific block, use it
  if (query.includes("/blocks/") && !query.endsWith("/blocks")) {
    return query;
  }
  // Otherwise, construct path (simplified - would need better parsing)
  const parts = query.split("/");
  if (parts.length >= 2 && parts[1] === "blocks") {
    if (blockIndex !== undefined) {
      return `${parts[0]}/blocks/${blockIndex}`;
    }
    return query;
  }
  return query;
}

/**
 * Validate all blocks from a query result
 */
export async function validateQueryBlocks(
  networkPath: string,
  query: string,
  schemaSet: string
): Promise<Record<string, ValidationResult>> {
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

  const allResults: Record<string, ValidationResult> = {};

  for (let i = 0; i < blocksArray.length; i++) {
    const block = blocksArray[i];
    if (!block || typeof block !== "object" || !block.type) {
      continue;
    }

    // Try to extract block path from query or construct it
    // For queries like "branch-1/blocks", we need to query each block individually
    let blockPath: string;
    if (query.includes("/blocks/")) {
      // Query already points to specific block(s)
      blockPath = extractBlockPathFromQuery(query, i);
    } else {
      // Query for blocks, need to find each block's path
      // Query for the block's type to find its path
      try {
        const blockQuery = query.endsWith("/blocks") 
          ? `${query}/${i}` 
          : `${query}/blocks/${i}`;
        const blockPathResult = wasm.query_from_files(
          filesJson,
          configContent || undefined,
          blockQuery
        );
        const pathBlock = JSON.parse(blockPathResult);
        if (pathBlock && pathBlock.type === block.type) {
          blockPath = blockQuery;
        } else {
          blockPath = extractBlockPathFromQuery(query, i);
        }
      } catch {
        blockPath = extractBlockPathFromQuery(query, i);
      }
    }

    const blockResults = await validateBlockInternal(
      block,
      block.type,
      blockPath,
      schemaSet,
      networkPath,
      configContent
    );

    // Merge results
    for (const [propPath, result] of Object.entries(blockResults)) {
      allResults[propPath] = result;
    }
  }

  return allResults;
}

/**
 * Validate a block with a known path (internal helper)
 */
async function validateBlockInternal(
  block: any,
  blockType: string,
  blockPath: string,
  schemaSet: string,
  networkPath: string,
  configContent: string | null
): Promise<Record<string, ValidationResult>> {
  const schema = getSchema(schemaSet, blockType);
  if (!schema) {
    return {
      [`${blockPath}/_schema`]: {
        is_valid: false,
        severity: "error",
        message: `Schema not found for block type '${blockType}' in schema set '${schemaSet}'`,
      },
    };
  }

  const wasm = getWasm();
  const { files } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  // Get schema metadata
  const schemaMetadata = getSchemaMetadata(schemaSet, blockType);
  if (!schemaMetadata) {
    return {
      [`${blockPath}/_schema`]: {
        is_valid: false,
        severity: "error",
        message: `Could not extract metadata for block type '${blockType}'`,
      },
    };
  }

  // Parse unit preferences
  const { blockTypes, dimensions, propertyDimensions } =
    parseUnitPreferences(configContent);
  const unitPreferences: UnitPreferences = {
    blockTypes,
    dimensions,
    propertyDimensions,
  };

  // Initialize dim for unit conversions
  await dim.init();

  const results: Record<string, ValidationResult> = {};

  // Validate using Effect Schema
  const validationResult = Schema.decodeUnknownEither(schema)(block);

  // Get all properties from schema (required + optional)
  const allProperties = [
    ...schemaMetadata.required,
    ...schemaMetadata.optional,
  ];

  // Check each property
  for (const propertyName of allProperties) {
    const propertyPath = `${blockPath}/${propertyName}`;
    const propertyMetadata = schemaMetadata.properties[propertyName] || {};

    // Try to get scope-resolved value by querying for the property
    let resolvedValue: any = undefined;
    let resolvedScope: string | undefined = undefined;

    try {
      const propertyQuery = `${blockPath}/${propertyName}`;
      const queryResult = wasm.query_from_files(
        filesJson,
        configContent || undefined,
        propertyQuery
      );
      const parsed = JSON.parse(queryResult);
      if (parsed !== null && parsed !== undefined) {
        resolvedValue = parsed;
        // TODO: Get actual scope from query result if available
        // For now, assume it came from block scope if present in block, otherwise from scope resolution
        resolvedScope = block[propertyName] !== undefined ? "block" : "scope";
      }
    } catch {
      // Query failed, property not found
    }

    // Check if property is required and missing
    const isRequired = schemaMetadata.required.includes(propertyName);
    const hasValue = block[propertyName] !== undefined && block[propertyName] !== null;

    if (isRequired && !hasValue && !resolvedValue) {
      results[propertyPath] = {
        is_valid: false,
        severity: "error",
        message: `Required property '${propertyName}' is missing for block type '${blockType}'`,
      };
      continue;
    }

    // If we have a value (from block or scope), validate constraints
    const valueToValidate = resolvedValue !== undefined ? resolvedValue : block[propertyName];
    
    if (valueToValidate !== undefined && valueToValidate !== null) {
      // Format value for display
      let formattedValue: string | undefined;
      if (typeof valueToValidate === "string") {
        formattedValue = valueToValidate;
      } else if (typeof valueToValidate === "number") {
        // Format with unit if we have metadata
        formattedValue = await formatValue(
          valueToValidate,
          propertyName,
          blockType,
          unitPreferences,
          propertyMetadata
        );
      }

      // Validate constraints if we have defaultUnit
      let constraintValid = true;
      let constraintMessage: string | undefined;

      if (propertyMetadata.defaultUnit && (propertyMetadata.min !== undefined || propertyMetadata.max !== undefined)) {
        try {
          // Convert value to defaultUnit for comparison
          const valueString = typeof valueToValidate === "string" 
            ? valueToValidate 
            : `${valueToValidate} ${propertyMetadata.defaultUnit}`;
          
          const valueInDefaultUnitString = dim.eval(
            `${valueString} as ${propertyMetadata.defaultUnit}`
          );
          const numericValue = parseFloat(valueInDefaultUnitString.split(" ")[0]);

          if (propertyMetadata.min !== undefined && numericValue < propertyMetadata.min) {
            constraintValid = false;
            constraintMessage = `Value ${numericValue} ${propertyMetadata.defaultUnit} is less than minimum ${propertyMetadata.min} ${propertyMetadata.defaultUnit}`;
          } else if (propertyMetadata.max !== undefined && numericValue > propertyMetadata.max) {
            constraintValid = false;
            constraintMessage = `Value ${numericValue} ${propertyMetadata.defaultUnit} is greater than maximum ${propertyMetadata.max} ${propertyMetadata.defaultUnit}`;
          }
        } catch (error) {
          // Unit conversion failed, skip constraint validation
          console.warn(
            `Failed to convert value for constraint validation: ${valueToValidate} to ${propertyMetadata.defaultUnit}`,
            error
          );
        }
      }

      // Check Effect Schema validation errors for this property
      if (Either.isLeft(validationResult)) {
        const errors = validationResult.left;
        // Check if this property has validation errors
        // Effect Schema errors are structured, we need to check if this property is mentioned
        const errorMessage = String(errors);
        if (errorMessage.includes(propertyName)) {
          results[propertyPath] = {
            is_valid: false,
            severity: "error",
            message: `Validation error for property '${propertyName}': ${errorMessage}`,
            value: formattedValue,
            scope: resolvedScope,
          };
          continue;
        }
      }

      // If constraint validation failed, use that
      if (!constraintValid) {
        results[propertyPath] = {
          is_valid: false,
          severity: "error",
          message: constraintMessage,
          value: formattedValue,
          scope: resolvedScope,
        };
        continue;
      }

      // Property is valid
      results[propertyPath] = {
        is_valid: true,
        value: formattedValue,
        scope: resolvedScope,
      };
    } else {
      // Property is optional and not present - valid
      results[propertyPath] = {
        is_valid: true,
      };
    }
  }

  return results;
}

/**
 * Validate all blocks in the network
 */
export async function validateNetworkBlocks(
  networkPath: string,
  schemaSet: string
): Promise<Record<string, ValidationResult>> {
  const wasm = getWasm();
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  // Query for all blocks
  const queryResult = wasm.query_from_files(
    filesJson,
    configContent || undefined,
    "blocks"
  );
  const blocks = JSON.parse(queryResult);

  // If query result is a single block, wrap it
  const blocksArray = Array.isArray(blocks) ? blocks : [blocks];

  const allResults: Record<string, ValidationResult> = {};

  // Query for all blocks to get their paths
  // For network validation, we need to iterate through branches
  try {
    // Query for all branches first
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
      const branchBlocksArray = Array.isArray(branchBlocks) ? branchBlocks : [branchBlocks];

      for (let i = 0; i < branchBlocksArray.length; i++) {
        const block = branchBlocksArray[i];
        if (!block || typeof block !== "object" || !block.type) {
          continue;
        }

        const blockPath = `${branchId}/blocks/${i}`;
        const blockResults = await validateBlockInternal(
          block,
          block.type,
          blockPath,
          schemaSet,
          networkPath,
          configContent
        );

        // Merge results
        for (const [propPath, result] of Object.entries(blockResults)) {
          allResults[propPath] = result;
        }
      }
    }
  } catch (error) {
    // Fallback: try to validate blocks directly
    console.warn("Failed to query branches, falling back to direct block validation", error);
    for (let i = 0; i < blocksArray.length; i++) {
      const block = blocksArray[i];
      if (!block || typeof block !== "object" || !block.type) {
        continue;
      }

      const blockPath = `blocks/${i}`;
      const blockResults = await validateBlockInternal(
        block,
        block.type,
        blockPath,
        schemaSet,
        networkPath,
        configContent
      );

      // Merge results
      for (const [propPath, result] of Object.entries(blockResults)) {
        allResults[propPath] = result;
      }
    }
  }

  return allResults;
}

