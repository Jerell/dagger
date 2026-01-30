import { Schema, Either } from "effect";
import * as path from "path";
import * as fs from "fs/promises";
import {
  getSchema,
  getSchemaMetadata,
  PropertyMetadata,
} from "./effectSchemas";
import { UnitPreferences } from "./unitFormatter";
import { formatValueUnified, FormatValueOptions } from "./valueFormatter";
import { parseUnitPreferences } from "./query";
import dim from "./dim";
import { parseValue, convertToNumber } from "./valueParser";
import { getDagger } from "../utils/getDagger";
import { resolveNetworkPath } from "../utils/network-path";

type NetworkFiles = {
  files: Record<string, string>;
  configContent: string | null;
};

async function readNetworkFiles(networkPath: string): Promise<NetworkFiles> {
  const absolutePath = resolveNetworkPath(networkPath);
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

export type ValidationResult = {
  is_valid: boolean;
  severity?: "error" | "warning";
  message?: string;
  /** Formatted value for display (with units) */
  value?: string;
  /** Raw resolved value (for operations to use) */
  rawValue?: PropertyValue;
  /** Where the property was resolved from */
  scope?: string;
};

export type Block = {
  type: string;
  [key: string]: string | number | null | undefined;
};

export type PropertyValue = string | number | null | undefined;

export type ResolvedProperty = {
  value: PropertyValue;
  scope: string;
};

export type ResolvedBlock = {
  type: string;
  properties: Record<string, ResolvedProperty>;
};

/**
 * Context for network operations - holds file data for efficient batch resolution.
 */
export type NetworkContext = {
  filesJson: string;
  configContent: string | null;
};

/**
 * Create a network context from a path.
 */
export async function createNetworkContext(
  networkPath: string,
): Promise<NetworkContext> {
  const { files, configContent } = await readNetworkFiles(networkPath);
  return {
    filesJson: JSON.stringify(files),
    configContent,
  };
}

/**
 * Resolve a single property for a block using scope resolution.
 * This is the core resolution function - uses WASM's resolve_property_with_scope
 * which follows the inheritance rules in config.toml.
 */
export function resolveProperty(
  ctx: NetworkContext,
  branchId: string,
  blockIndex: number,
  propertyName: string,
): ResolvedProperty | null {
  const dagger = getDagger();
  try {
    const scopeResult = dagger.resolve_property_with_scope(
      ctx.filesJson,
      ctx.configContent || undefined,
      branchId,
      blockIndex,
      propertyName,
    );
    const parsed = JSON.parse(scopeResult);
    if (parsed?.value !== undefined && parsed.scope) {
      return {
        value: parsed.value,
        scope: parsed.scope,
      };
    }
  } catch {
    // Property not found in any scope
  }
  return null;
}

/**
 * Resolve all schema-defined properties for a block.
 * Uses the schema to know what properties the block type should have,
 * then resolves each using scope resolution.
 *
 * This is THE unified way to get resolved block properties - used by both
 * validation and operations.
 */
export function resolveBlockPropertiesFromSchema(
  block: Block,
  branchId: string,
  blockIndex: number,
  schemaSet: string,
  ctx: NetworkContext,
): Record<string, ResolvedProperty> {
  const schemaMetadata = getSchemaMetadata(schemaSet, block.type);
  if (!schemaMetadata) {
    // No schema for this block type - just return block-level properties
    const resolved: Record<string, ResolvedProperty> = {};
    for (const [key, value] of Object.entries(block)) {
      if (key !== "type" && value !== undefined && value !== null) {
        resolved[key] = { value, scope: "block" };
      }
    }
    return resolved;
  }

  const resolved: Record<string, ResolvedProperty> = {};
  const allProperties = [
    ...schemaMetadata.required,
    ...schemaMetadata.optional,
  ];

  for (const propName of allProperties) {
    // First check if property is directly on the block
    if (block[propName] !== undefined && block[propName] !== null) {
      resolved[propName] = {
        value: block[propName],
        scope: "block",
      };
    } else {
      // Try to resolve from scope chain
      const resolvedProp = resolveProperty(ctx, branchId, blockIndex, propName);
      if (resolvedProp) {
        resolved[propName] = resolvedProp;
      }
    }
  }

  return resolved;
}

/**
 * Get an enriched block with all schema-defined properties resolved.
 * Returns a new block object with resolved values merged in.
 *
 * This is THE unified way to get a block with inherited properties - used by
 * both validation and operations.
 */
export function getEnrichedBlockFromSchema(
  block: Block,
  branchId: string,
  blockIndex: number,
  schemaSet: string,
  ctx: NetworkContext,
): Block {
  const resolved = resolveBlockPropertiesFromSchema(
    block,
    branchId,
    blockIndex,
    schemaSet,
    ctx,
  );

  const enriched: Block = { ...block };
  for (const [propName, { value }] of Object.entries(resolved)) {
    if (enriched[propName] === undefined || enriched[propName] === null) {
      enriched[propName] = value;
    }
  }

  return enriched;
}

/**
 * Extract resolved properties for a specific block from validation results.
 * Returns an object with all resolved property values (raw, not formatted).
 *
 * This is THE way for operations to get resolved block properties - they
 * should NOT do their own property resolution.
 */
export function getResolvedBlockProperties(
  validationResults: Record<string, ValidationResult>,
  branchId: string,
  blockIndex: number,
): Record<string, PropertyValue> {
  const blockPath = `${branchId}/blocks/${blockIndex}`;
  const resolved: Record<string, PropertyValue> = {};

  for (const [path, result] of Object.entries(validationResults)) {
    if (path.startsWith(blockPath + "/")) {
      const propName = path.slice(blockPath.length + 1);
      // Don't include nested paths (e.g., "branch-1/blocks/0/foo/bar")
      if (!propName.includes("/") && result.rawValue !== undefined) {
        resolved[propName] = result.rawValue;
      }
    }
  }

  return resolved;
}

/**
 * Get an enriched block using validation results.
 * The validation results contain already-resolved properties with rawValue.
 *
 * This is THE unified way for operations to get blocks with resolved properties.
 */
export function getEnrichedBlockFromValidation(
  block: Block,
  validationResults: Record<string, ValidationResult>,
  branchId: string,
  blockIndex: number,
): Block {
  const resolved = getResolvedBlockProperties(
    validationResults,
    branchId,
    blockIndex,
  );

  const enriched: Block = { ...block };
  for (const [propName, value] of Object.entries(resolved)) {
    if (value !== undefined && value !== null) {
      enriched[propName] = value;
    }
  }

  return enriched;
}

/**
 * Validate a block directly without network context (for POST /api/schema/validate)
 */
export async function validateBlockDirect(
  block: Block,
  blockType: string,
  schemaSet: string,
): Promise<Record<string, ValidationResult>> {
  const schema = getSchema(schemaSet, blockType);
  if (!schema) {
    return {
      [`${blockType}/_schema`]: {
        is_valid: true,
        severity: "warning",
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
/**
 * Strip query string (everything after ?) from a path
 */
function stripQueryString(path: string): string {
  const queryIndex = path.indexOf("?");
  return queryIndex >= 0 ? path.substring(0, queryIndex) : path;
}

function extractBlockPathFromQuery(query: string, blockIndex?: number): string {
  // Strip query string from query before constructing paths
  const cleanQuery = stripQueryString(query);

  // If query already points to a specific block, use it
  if (cleanQuery.includes("/blocks/") && !cleanQuery.endsWith("/blocks")) {
    return cleanQuery;
  }
  // Otherwise, construct path (simplified - would need better parsing)
  const parts = cleanQuery.split("/");
  if (parts.length >= 2 && parts[1] === "blocks") {
    if (blockIndex !== undefined) {
      return `${parts[0]}/blocks/${blockIndex}`;
    }
    return cleanQuery;
  }
  return cleanQuery;
}

/**
 * Validate all blocks from a query result
 */
export async function validateQueryBlocks(
  networkPath: string,
  query: string,
  schemaSet: string,
  queryOverrides: Record<string, string> = {},
): Promise<Record<string, ValidationResult>> {
  // Read files once at the top level
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  // Initialize dim once for all blocks
  await dim.init();

  // Parse unit preferences once
  const {
    blockTypes,
    dimensions: configDimensions,
    propertyDimensions,
  } = parseUnitPreferences(configContent);

  // Merge HTTP query string overrides with any overrides from query path
  // (Query path can also have units like "branch-1/blocks?units=length:km")
  const { parseUnitOverrides } = await import("./query");
  const pathOverrides = parseUnitOverrides(query);
  const mergedOverrides = { ...pathOverrides, ...queryOverrides };

  // Merge query overrides into dimensions
  const mergedDimensions = { ...configDimensions };
  for (const [key, unit] of Object.entries(mergedOverrides)) {
    mergedDimensions[key as keyof typeof mergedDimensions] = unit;
  }

  const unitPreferences: UnitPreferences = {
    queryOverrides: mergedOverrides,
    blockTypes,
    dimensions: mergedDimensions,
    propertyDimensions,
  };

  const dagger = getDagger();

  // Extract original query path (remove unit parameters)
  const baseQuery = query.split("?")[0].split("&")[0];

  // Execute query to get blocks
  const queryResult = dagger.query_from_files(
    filesJson,
    configContent || undefined,
    baseQuery,
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
    // Use baseQuery (already stripped of query string) for path construction
    let blockPath: string;
    if (baseQuery.includes("/blocks/")) {
      // Query already points to specific block(s)
      blockPath = extractBlockPathFromQuery(baseQuery, i);
    } else {
      // Query for blocks, need to find each block's path
      // Query for the block's type to find its path
      try {
        const blockQuery = baseQuery.endsWith("/blocks")
          ? `${baseQuery}/${i}`
          : `${baseQuery}/blocks/${i}`;
        const blockPathResult = dagger.query_from_files(
          filesJson,
          configContent || undefined,
          blockQuery,
        );
        const pathBlock = JSON.parse(blockPathResult);
        if (pathBlock && pathBlock.type === block.type) {
          blockPath = blockQuery;
        } else {
          blockPath = extractBlockPathFromQuery(baseQuery, i);
        }
      } catch {
        blockPath = extractBlockPathFromQuery(baseQuery, i);
      }
    }

    const blockResults = await validateBlockInternal(
      block,
      block.type,
      blockPath,
      schemaSet,
      networkPath,
      configContent,
      queryOverrides,
      files,
      filesJson,
      unitPreferences,
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
  block: Block,
  blockType: string,
  blockPath: string,
  schemaSet: string,
  networkPath: string | null,
  configContent: string | null,
  queryOverrides: Record<string, string> = {},
  files: Record<string, string>,
  filesJson: string,
  unitPreferences: UnitPreferences,
): Promise<Record<string, ValidationResult>> {
  const schema = getSchema(schemaSet, blockType);
  if (!schema) {
    return {
      [`${blockPath}/_schema`]: {
        is_valid: true,
        severity: "warning",
        message: `Schema not found for block type '${blockType}' in schema set '${schemaSet}'`,
      },
    };
  }

  const dagger = getDagger();

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

  // Unit preferences are passed in from the caller (already initialized)

  const results: Record<string, ValidationResult> = {};

  async function convertValueForValidation(
    value: PropertyValue,
    propertyName: string,
    propertyMetadata: PropertyMetadata,
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
          error,
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
        propertyMetadata,
      );
      if (converted !== undefined) {
        blockForValidation[propertyName] = converted;
      }
    }
  }

  const pathParts = blockPath.split("/blocks/");
  const completeValidationObject: Record<
    string,
    string | number | null | undefined
  > = {
    ...blockForValidation,
    type: block.type,
  };

  const allProperties = [
    ...schemaMetadata.required,
    ...schemaMetadata.optional,
  ];

  const propertyScopes: Record<string, string> = {};
  const propertyValues: Record<string, PropertyValue> = {};

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
          propMetadata,
        );
        completeValidationObject[propName] = converted ?? block[propName];
      } else {
        completeValidationObject[propName] = block[propName];
      }
    } else if (pathParts.length === 2) {
      try {
        const scopeResult = dagger.resolve_property_with_scope(
          filesJson,
          configContent || undefined,
          pathParts[0],
          parseInt(pathParts[1], 10),
          propName,
        );
        const parsed = JSON.parse(scopeResult);
        if (parsed?.value !== undefined && parsed.scope) {
          propertyScopes[propName] = parsed.scope;
          propertyValues[propName] = parsed.value;
          if (propMetadata?.defaultUnit) {
            const converted = await convertValueForValidation(
              parsed.value,
              propName,
              propMetadata,
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
    completeValidationObject,
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
        networkPath: networkPath ?? undefined,
        schemaSet,
        blockPath,
      };

      const formattedValue = await formatValueUnified(
        resolvedValue,
        formatOptions,
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
            error,
          );
        }
      }

      if (!constraintValid) {
        results[propertyPath] = {
          is_valid: false,
          severity: "error",
          message: constraintMessage,
          value: formattedValue,
          rawValue: resolvedValue,
          scope: resolvedScope,
        };
        continue;
      }

      const errorPathMatches = errorMessage.matchAll(/└─\s*\["([^"]+)"\]/g);
      const errorPaths = Array.from(errorPathMatches, (m) => m[1]);
      const hasError = errorPaths.includes(propertyName);
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
          const errorLines = errorMessage.split("\n");
          const propertyErrorLine = errorLines.find(
            (line) =>
              line.includes(`["${propertyName}"]`) &&
              !line.includes("readonly"),
          );
          if (propertyErrorLine) {
            let cleaned = propertyErrorLine.trim();
            cleaned = cleaned.replace(/^└─\s*\["[^"]+"\]\s*/, "");
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
          rawValue: resolvedValue,
          scope: resolvedScope,
        };
        continue;
      }

      const validResult: ValidationResult = {
        is_valid: true,
        rawValue: resolvedValue,
      };
      // Always include value and scope for valid properties that have values
      if (formattedValue !== undefined && formattedValue !== null) {
        validResult.value = formattedValue;
      } else if (resolvedValue !== undefined && resolvedValue !== null) {
        // Fallback to original value if formatting failed (convert to string)
        validResult.value = String(resolvedValue);
      }
      if (resolvedScope !== undefined && resolvedScope !== null) {
        validResult.scope = resolvedScope;
      }
      results[propertyPath] = validResult;
    } else {
      results[propertyPath] = {
        is_valid: true,
      };
    }
  }

  return results;
}

export type NetworkSource =
  | { type: "networkId"; networkId: string }
  | { type: "data"; network: NetworkData };

export type NetworkData = {
  groups: Array<{ id: string; label?: string; branchIds: string[] }>;
  branches: Array<{
    id: string;
    label?: string;
    parentId?: string;
    blocks: Block[];
  }>;
};

/**
 * Validate all blocks in the network.
 *
 * @param source - Network source (networkId or inline data)
 * @param schemaSet - Schema set to use for validation
 * @param baseNetworkId - Optional networkId for property resolution when source is inline data
 * @param queryOverrides - Optional unit overrides
 */
export async function validateNetworkBlocks(
  source: NetworkSource,
  schemaSet: string,
  baseNetworkId?: string,
  queryOverrides: Record<string, string> = {},
): Promise<Record<string, ValidationResult>> {
  // Determine the network path for file-based property resolution
  let networkPath: string | null = null;
  if (source.type === "networkId") {
    networkPath = resolveNetworkPath(source.networkId);
  } else if (baseNetworkId) {
    networkPath = resolveNetworkPath(baseNetworkId);
  }

  // Read files for property resolution (if we have a path)
  let files: Record<string, string> = {};
  let configContent: string | null = null;
  let filesJson = "{}";

  if (networkPath) {
    const networkFiles = await readNetworkFiles(networkPath);
    files = networkFiles.files;
    configContent = networkFiles.configContent;
    filesJson = JSON.stringify(files);
  }

  // Initialize dim once for all blocks
  await dim.init();

  // Parse unit preferences once
  const {
    blockTypes,
    dimensions: configDimensions,
    propertyDimensions,
  } = parseUnitPreferences(configContent);

  // Merge query overrides into dimensions if the key matches a known dimension
  const mergedDimensions = { ...configDimensions };
  for (const [key, unit] of Object.entries(queryOverrides)) {
    mergedDimensions[key] = unit;
  }

  const unitPreferences: UnitPreferences = {
    queryOverrides,
    blockTypes,
    dimensions: mergedDimensions,
    propertyDimensions,
  };

  const dagger = getDagger();
  const allResults: Record<string, ValidationResult> = {};

  // Get branches either from inline data or by querying files
  let branches: Array<{ id: string; blocks: Block[] }> = [];

  if (source.type === "data") {
    // Use inline data directly
    branches = source.network.branches;
  } else {
    // Query for branches from files
    try {
      const nodesQuery = dagger.query_from_files(
        filesJson,
        configContent || undefined,
        "network/nodes",
      );
      const nodes = JSON.parse(nodesQuery);
      const nodesArray = Array.isArray(nodes) ? nodes : [nodes];

      // Filter for branch nodes (type is "branch" from TOML)
      const branchNodes = nodesArray.filter(
        (node: any) =>
          node && typeof node === "object" && node.type === "branch",
      );

      for (const branch of branchNodes) {
        if (!branch || typeof branch !== "object" || !branch.id) {
          continue;
        }

        // Query for blocks in this branch
        const branchBlocksQuery = dagger.query_from_files(
          filesJson,
          configContent || undefined,
          `${branch.id}/blocks`,
        );
        const branchBlocks = JSON.parse(branchBlocksQuery);
        const branchBlocksArray = Array.isArray(branchBlocks)
          ? branchBlocks
          : [branchBlocks];

        branches.push({ id: branch.id, blocks: branchBlocksArray });
      }
    } catch (error) {
      console.warn("Failed to query network nodes for validation", error);
      throw error;
    }
  }

  // Validate all blocks from all branches
  for (const branch of branches) {
    const branchId = branch.id;

    for (let i = 0; i < branch.blocks.length; i++) {
      const block = branch.blocks[i];
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
        configContent,
        queryOverrides,
        files,
        filesJson,
        unitPreferences,
      );

      // Merge results
      for (const [propPath, result] of Object.entries(blockResults)) {
        allResults[propPath] = result;
      }
    }
  }

  return allResults;
}
