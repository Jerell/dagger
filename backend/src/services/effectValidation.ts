import { Schema, Either } from "effect";
import { DaggerWasm } from "../../pkg/dagger.js";
import * as path from "path";
import * as fs from "fs/promises";
import {
  getSchema,
  getSchemaMetadata,
  getPropertyConstraints,
  PropertyMetadata,
} from "./effectSchemas";
import { UnitPreferences } from "./unitFormatter";
import { formatValueUnified, FormatValueOptions } from "./valueFormatter";
import { parseUnitPreferences } from "./query";
import dim from "./dim";
import { parseValue, convertToNumber } from "./valueParser";

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
    const hasValue =
      block[propertyName] !== undefined && block[propertyName] !== null;

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

  async function convertValueForValidation(
    value: any,
    propertyName: string,
    propertyMetadata: PropertyMetadata
  ): Promise<number | undefined> {
    const parsed = parseValue(value);
    if (!parsed) {
      return undefined;
    }

    if (parsed.isUnitString && propertyMetadata?.defaultUnit) {
      try {
        return await convertToNumber(value, propertyMetadata.defaultUnit);
      } catch (error) {
        console.warn(
          `Failed to convert ${propertyName} value "${value}" to ${propertyMetadata.defaultUnit}:`,
          error
        );
        return undefined;
      }
    }

    return parsed.numericValue;
  }

  const blockForValidation = { ...block };
  for (const propertyName of Object.keys(blockForValidation)) {
    const value = blockForValidation[propertyName];
    const propertyMetadata = schemaMetadata.properties[propertyName];

    if (propertyMetadata?.defaultUnit !== undefined) {
      const converted = await convertValueForValidation(
        value,
        propertyName,
        propertyMetadata
      );
      if (converted !== undefined) {
        blockForValidation[propertyName] = converted;
      }
    }
  }

  const pathParts = blockPath.split("/blocks/");
  const completeValidationObject: any = {
    ...blockForValidation,
    type: block.type,
  };

  const allProperties = [
    ...schemaMetadata.required,
    ...schemaMetadata.optional,
  ];

  const propertyScopes: Record<string, string> = {};
  const propertyValues: Record<string, any> = {};

  for (const propName of allProperties) {
    if (completeValidationObject[propName] !== undefined) {
      propertyScopes[propName] = "block";
      propertyValues[propName] = block[propName];
      continue;
    }
    const propMetadata = schemaMetadata.properties[propName];
    if (block[propName] !== undefined) {
      propertyScopes[propName] = "block";
      propertyValues[propName] = block[propName];
      if (propMetadata?.defaultUnit) {
        const converted = await convertValueForValidation(
          block[propName],
          propName,
          propMetadata
        );
        completeValidationObject[propName] = converted ?? block[propName];
      } else {
        completeValidationObject[propName] = block[propName];
      }
    } else if (pathParts.length === 2) {
      try {
        const scopeResult = wasm.resolve_property_with_scope(
          filesJson,
          configContent || undefined,
          pathParts[0],
          parseInt(pathParts[1], 10),
          propName
        );
        const parsed = JSON.parse(scopeResult);
        if (parsed?.value !== undefined && parsed.scope) {
          propertyScopes[propName] = parsed.scope;
          propertyValues[propName] = parsed.value;
          if (propMetadata?.defaultUnit) {
            const converted = await convertValueForValidation(
              parsed.value,
              propName,
              propMetadata
            );
            completeValidationObject[propName] = converted ?? parsed.value;
          } else {
            completeValidationObject[propName] = parsed.value;
          }
        }
      } catch {
        // Property not found in scope
      }
    }
  }

  const fullValidationResult = Schema.decodeUnknownEither(schema)(
    completeValidationObject
  );
  const validationErrors = Either.isLeft(fullValidationResult)
    ? fullValidationResult.left
    : null;
  const errorMessage = validationErrors ? String(validationErrors) : "";

  for (const propertyName of allProperties) {
    const propertyPath = `${blockPath}/${propertyName}`;
    const propertyMetadata = schemaMetadata.properties[propertyName] || {};

    const resolvedValue = propertyValues[propertyName];
    const resolvedScope = propertyScopes[propertyName];

    const isRequired = schemaMetadata.required.includes(propertyName);
    const hasValue = resolvedValue !== undefined && resolvedValue !== null;

    if (isRequired && !hasValue) {
      results[propertyPath] = {
        is_valid: false,
        severity: "error",
        message: `Required property '${propertyName}' is missing for block type '${blockType}'`,
      };
      continue;
    }

    if (hasValue) {
      const formatOptions: FormatValueOptions = {
        propertyName,
        blockType,
        unitPreferences,
        propertyMetadata,
        networkPath,
        schemaSet,
        blockPath,
      };

      const formattedValue = await formatValueUnified(
        resolvedValue,
        formatOptions
      );

      const isNumericProperty = !!propertyMetadata?.defaultUnit;
      let constraintValid = true;
      let constraintMessage: string | undefined;

      if (
        isNumericProperty &&
        (propertyMetadata.min !== undefined ||
          propertyMetadata.max !== undefined)
      ) {
        try {
          const numericValue = completeValidationObject[propertyName];
          if (typeof numericValue === "number") {
            if (
              propertyMetadata.min !== undefined &&
              numericValue < propertyMetadata.min
            ) {
              constraintValid = false;
              constraintMessage = `Value ${numericValue} ${propertyMetadata.defaultUnit} is less than minimum ${propertyMetadata.min} ${propertyMetadata.defaultUnit}`;
            } else if (
              propertyMetadata.max !== undefined &&
              numericValue > propertyMetadata.max
            ) {
              constraintValid = false;
              constraintMessage = `Value ${numericValue} ${propertyMetadata.defaultUnit} is greater than maximum ${propertyMetadata.max} ${propertyMetadata.defaultUnit}`;
            }
          }
        } catch (error) {
          console.warn(
            `Failed to validate constraints for ${propertyName}:`,
            error
          );
        }
      }

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

      const hasError = errorMessage.includes(propertyName);
      if (hasError) {
        let simpleMessage: string;

        if (
          errorMessage.includes("Expected number") &&
          errorMessage.includes("actual")
        ) {
          const actualMatch = errorMessage.match(/actual "([^"]+)"/);
          const actualValue = actualMatch ? actualMatch[1] : "a unit string";
          simpleMessage = `Property '${propertyName}' must be a number, but received "${actualValue}". Unit conversion may have failed.`;
        } else if (errorMessage.includes("From side refinement failure")) {
          if (propertyMetadata.min !== undefined) {
            simpleMessage = `Property '${propertyName}' must be greater than ${
              propertyMetadata.min
            }${
              propertyMetadata.defaultUnit
                ? ` ${propertyMetadata.defaultUnit}`
                : ""
            }`;
          } else if (propertyMetadata.max !== undefined) {
            simpleMessage = `Property '${propertyName}' must be less than ${
              propertyMetadata.max
            }${
              propertyMetadata.defaultUnit
                ? ` ${propertyMetadata.defaultUnit}`
                : ""
            }`;
          } else {
            simpleMessage = `Property '${propertyName}' does not meet the constraint requirements`;
          }
        } else if (errorMessage.includes("greater than")) {
          const minMatch = errorMessage.match(/greater than (\d+)/);
          if (minMatch) {
            simpleMessage = `Property '${propertyName}' must be greater than ${
              minMatch[1]
            }${
              propertyMetadata.defaultUnit
                ? ` ${propertyMetadata.defaultUnit}`
                : ""
            }`;
          } else {
            simpleMessage = `Property '${propertyName}' does not meet the minimum constraint`;
          }
        } else if (errorMessage.includes("less than")) {
          const maxMatch = errorMessage.match(/less than (\d+)/);
          if (maxMatch) {
            simpleMessage = `Property '${propertyName}' must be less than ${
              maxMatch[1]
            }${
              propertyMetadata.defaultUnit
                ? ` ${propertyMetadata.defaultUnit}`
                : ""
            }`;
          } else {
            simpleMessage = `Property '${propertyName}' exceeds the maximum constraint`;
          }
        } else {
          const lines = errorMessage.split("\n");
          const relevantLine = lines.find(
            (line) => line.includes(propertyName) && !line.includes("readonly")
          );
          if (relevantLine) {
            let cleaned = relevantLine.trim();
            cleaned = cleaned.replace(/^Length\s*/, "");
            cleaned = cleaned.replace(/^From side refinement failure\s*/, "");
            simpleMessage =
              cleaned || `Property '${propertyName}' validation failed`;
          } else {
            simpleMessage = `Property '${propertyName}' validation failed`;
          }
        }

        results[propertyPath] = {
          is_valid: false,
          severity: "error",
          message: simpleMessage,
          value: formattedValue,
          scope: resolvedScope,
        };
        continue;
      }

      results[propertyPath] = {
        is_valid: true,
        value: formattedValue,
        scope: resolvedScope,
      };
    } else {
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
      const branchBlocksArray = Array.isArray(branchBlocks)
        ? branchBlocks
        : [branchBlocks];

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
    console.warn(
      "Failed to query branches, falling back to direct block validation",
      error
    );
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
