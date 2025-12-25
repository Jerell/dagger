import { DaggerWasm } from "../../pkg/dagger.js";
import * as path from "path";
import * as fs from "fs/promises";
import dim from "./dim";
import { formatQueryResult } from "./unitFormatter";
import { getBlockSchemaProperties } from "./effectSchemaProperties";

// With nodejs target, WASM is initialized synchronously when module loads
let daggerWasm: DaggerWasm | null = null;

function getWasm() {
  if (!daggerWasm) {
    daggerWasm = new DaggerWasm();
  }
  return daggerWasm;
}

function resolvePath(relativePath: string): string {
  // Resolve relative to process.cwd() which should be the backend directory
  // when the server is running
  // For WASM, we need to use absolute paths
  const resolved = path.resolve(process.cwd(), relativePath);
  // Normalize the path to ensure it's in the correct format
  return path.normalize(resolved);
}

async function readNetworkFiles(networkPath: string): Promise<{
  files: Record<string, string>;
  configContent: string | null;
}> {
  const absolutePath = resolvePath(networkPath);
  const files: Record<string, string> = {};
  let configContent: string | null = null;

  // Read all TOML files in the directory
  const entries = await fs.readdir(absolutePath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".toml")) {
      const filePath = path.join(absolutePath, entry.name);
      const content = await fs.readFile(filePath, "utf-8");

      if (entry.name === "config.toml") {
        configContent = content;
      } else {
        files[entry.name] = content;
      }
    }
  }

  return { files, configContent };
}

export interface UnitPreferences {
  queryOverrides?: Record<string, string>;
  blockTypes?: Record<string, Record<string, string>>;
  dimensions?: Record<string, string>;
  originalStrings?: Record<string, string>;
  propertyDimensions?: Record<string, string>; // Maps property names to dimensions (e.g., "ambientTemperature" -> "temperature")
}

/**
 * Parse unit preferences and property dimensions from config.toml content
 */
export function parseUnitPreferences(configContent: string | null): {
  blockTypes: Record<string, Record<string, string>>;
  dimensions: Record<string, string>;
  propertyDimensions: Record<string, string>;
} {
  const blockTypes: Record<string, Record<string, string>> = {};
  const dimensions: Record<string, string> = {};
  const propertyDimensions: Record<string, string> = {};

  if (!configContent) {
    return { blockTypes, dimensions, propertyDimensions };
  }

  // Simple TOML parsing for unitPreferences and dimensions sections
  const lines = configContent.split("\n");
  let inUnitPrefs = false;
  let inUnitPrefsDimensions = false; // Track if we're in [unitPreferences.dimensions]
  let inDimensions = false; // Track if we're in [dimensions] (property -> dimension map)
  let currentBlockType: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for [unitPreferences] sections
    if (trimmed.startsWith("[unitPreferences")) {
      inUnitPrefs = true;
      inDimensions = false;
      // Check for [unitPreferences.dimensions] first (before matching as block type)
      if (trimmed === "[unitPreferences.dimensions]") {
        // [unitPreferences.dimensions] section: dimension -> preferred unit
        currentBlockType = null;
        inUnitPrefsDimensions = true;
      } else {
        // Extract block type: [unitPreferences.Pipe] -> "Pipe"
        const match = trimmed.match(/\[unitPreferences\.([^\]]+)\]/);
        if (match) {
          currentBlockType = match[1];
          inUnitPrefsDimensions = false;
          if (!blockTypes[currentBlockType]) {
            blockTypes[currentBlockType] = {};
          }
        }
      }
    }
    // Check for [dimensions] section (property name -> dimension mapping)
    else if (trimmed === "[dimensions]" || trimmed === "[propertyDimensions]") {
      inDimensions = true;
      inUnitPrefs = false;
      inUnitPrefsDimensions = false;
      currentBlockType = null;
    }
    // Check for other sections
    else if (trimmed.startsWith("[")) {
      inUnitPrefs = false;
      inUnitPrefsDimensions = false;
      inDimensions = false;
      currentBlockType = null;
    }
    // Parse key-value pairs
    else if (trimmed.includes("=") && !trimmed.startsWith("#")) {
      const [key, value] = trimmed.split("=").map((s) => s.trim());
      const cleanValue = value.replace(/^["']|["']$/g, ""); // Remove quotes

      if (inDimensions) {
        // [dimensions] section: property name -> dimension
        propertyDimensions[key] = cleanValue;
      } else if (inUnitPrefsDimensions) {
        // [unitPreferences.dimensions] section: dimension -> preferred unit
        dimensions[key] = cleanValue;
      } else if (inUnitPrefs && currentBlockType) {
        // [unitPreferences.BlockType] section: property -> preferred unit
        blockTypes[currentBlockType][key] = cleanValue;
      }
    }
  }

  return { blockTypes, dimensions, propertyDimensions };
}

/**
 * Extract unit overrides from query string (e.g., "?units=length:km,diameter:m")
 */
function parseUnitOverrides(query: string): Record<string, string> {
  const overrides: Record<string, string> = {};
  const unitsMatch = query.match(/[?&]units=([^&]+)/);
  if (unitsMatch) {
    const unitsStr = unitsMatch[1];
    for (const pair of unitsStr.split(",")) {
      const [prop, unit] = pair.split(":").map((s) => s.trim());
      if (prop && unit) {
        overrides[prop] = unit;
      }
    }
  }
  return overrides;
}

export async function queryNetwork(
  networkPath: string,
  query: string,
  schemaVersion?: string
): Promise<any> {
  // Initialize dim module
  await dim.init();

  const wasm = getWasm();

  // Read files in Node.js and pass contents to WASM
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  // Parse unit preferences and property dimensions from config
  const { blockTypes, dimensions, propertyDimensions } =
    parseUnitPreferences(configContent);

  // Parse unit overrides from query string
  const queryOverrides = parseUnitOverrides(query);

  // Extract original query path (remove unit parameters)
  const baseQuery = query.split("?")[0].split("&")[0];

  try {
    const result = wasm.query_from_files(
      filesJson,
      configContent || undefined,
      baseQuery
    );
    const parsedResult = JSON.parse(result);

    // Extract property name and block type from query path for top-level unit strings
    // Query format: "branch-4/blocks/0/ambientTemperature" -> property = "ambientTemperature"
    const queryParts = baseQuery.split("/");
    let propertyName: string | undefined;
    let blockType: string | undefined;

    // Find the last part that's not a number or known path segment
    const lastPart = queryParts[queryParts.length - 1];
    if (lastPart && !/^\d+$/.test(lastPart) && lastPart !== "blocks") {
      propertyName = lastPart;

      // Try to get block type by querying the block (remove the property name from path)
      // e.g., "branch-4/blocks/0/ambientTemperature" -> "branch-4/blocks/0"
      const blockQueryParts = queryParts.slice(0, -1);
      if (
        blockQueryParts.length >= 3 &&
        blockQueryParts[blockQueryParts.length - 2] === "blocks"
      ) {
        const blockQuery = blockQueryParts.join("/");
        try {
          const blockResult = wasm.query_from_files(
            filesJson,
            configContent || undefined,
            blockQuery
          );
          const blockData = JSON.parse(blockResult);
          if (blockData && typeof blockData === "object" && blockData.type) {
            blockType = blockData.type;
          }
        } catch {
          // Ignore errors when trying to get block type
        }
      }
    }

    // Collect original strings from the result
    const originalStrings: Record<string, string> = {};
    function collectOriginalStrings(obj: any, prefix = "") {
      if (typeof obj === "object" && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          if (
            key.startsWith("_") &&
            key.endsWith("_original") &&
            typeof value === "string"
          ) {
            const propName = key.slice(1, -9); // Remove _ and _original
            originalStrings[`_${propName}_original`] = value;
          } else if (typeof value === "object") {
            collectOriginalStrings(value, `${prefix}${key}.`);
          }
        }
      }
    }
    collectOriginalStrings(parsedResult);

    // Try to get schema metadata for the property if we have block type
    let propertyMetadata:
      | { dimension?: string; defaultUnit?: string }
      | undefined;
    if (blockType && propertyName) {
      try {
        // Query schema properties for this block to get metadata
        const schemaQuery = queryParts.slice(0, -1).join("/"); // Remove property name
        const schemaProperties = await getBlockSchemaProperties(
          networkPath,
          schemaQuery,
          schemaVersion || "v1.0"
        );
        // Look for this property in the schema results
        const propertyKey = `${schemaQuery}/${propertyName}`;
        if (schemaProperties[propertyKey]) {
          const propInfo = schemaProperties[propertyKey];
          propertyMetadata = {
            dimension: propInfo.dimension,
            defaultUnit: propInfo.defaultUnit,
          };
        }
      } catch {
        // Schema lookup failed, continue without metadata
      }
    }

    // If no schema metadata, try config dimension map
    if (
      !propertyMetadata?.dimension &&
      propertyName &&
      propertyDimensions[propertyName]
    ) {
      propertyMetadata = {
        dimension: propertyDimensions[propertyName],
      };
    }

    // Apply unit preferences
    const unitPreferences: UnitPreferences = {
      queryOverrides,
      blockTypes,
      dimensions,
      originalStrings,
      propertyDimensions,
    };

    const formatted = await formatQueryResult(
      parsedResult,
      unitPreferences,
      blockType,
      propertyName,
      propertyMetadata
    );
    return formatted;
  } catch (error: any) {
    // WASM errors might not be properly propagated, check if it's a string error
    const errorMessage = error?.message || error?.toString() || String(error);
    throw new Error(`WASM query failed: ${errorMessage}`);
  }
}
