import { DaggerWasm } from "../../pkg/dagger.js";
import * as path from "path";
import * as fs from "fs/promises";
import dim from "./dim";
import { formatQueryResult } from "./unitFormatter";

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
}

/**
 * Parse unit preferences from config.toml content
 */
function parseUnitPreferences(configContent: string | null): {
  blockTypes: Record<string, Record<string, string>>;
  dimensions: Record<string, string>;
} {
  const blockTypes: Record<string, Record<string, string>> = {};
  const dimensions: Record<string, string> = {};

  if (!configContent) {
    return { blockTypes, dimensions };
  }

  // Simple TOML parsing for unitPreferences section
  // Format: [unitPreferences.BlockType] or [unitPreferences.dimensions]
  const lines = configContent.split("\n");
  let inUnitPrefs = false;
  let currentBlockType: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[unitPreferences")) {
      inUnitPrefs = true;
      // Extract block type: [unitPreferences.Pipe] -> "Pipe"
      const match = trimmed.match(/\[unitPreferences\.([^\]]+)\]/);
      if (match) {
        currentBlockType = match[1];
        if (!blockTypes[currentBlockType]) {
          blockTypes[currentBlockType] = {};
        }
      } else if (trimmed.includes("dimensions")) {
        currentBlockType = null;
      }
    } else if (trimmed.startsWith("[") && !trimmed.startsWith("[unitPreferences")) {
      inUnitPrefs = false;
      currentBlockType = null;
    } else if (inUnitPrefs && trimmed.includes("=")) {
      const [key, value] = trimmed.split("=").map((s) => s.trim());
      const cleanValue = value.replace(/^["']|["']$/g, ""); // Remove quotes
      if (currentBlockType) {
        blockTypes[currentBlockType][key] = cleanValue;
      } else {
        dimensions[key] = cleanValue;
      }
    }
  }

  return { blockTypes, dimensions };
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
  query: string
): Promise<any> {
  // Initialize dim module
  await dim.init();

  const wasm = getWasm();

  // Read files in Node.js and pass contents to WASM
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  // Parse unit preferences from config
  const { blockTypes, dimensions } = parseUnitPreferences(configContent);

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

    // Collect original strings from the result
    const originalStrings: Record<string, string> = {};
    function collectOriginalStrings(obj: any, prefix = "") {
      if (typeof obj === "object" && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          if (key.startsWith("_") && key.endsWith("_original") && typeof value === "string") {
            const propName = key.slice(1, -9); // Remove _ and _original
            originalStrings[`_${propName}_original`] = value;
          } else if (typeof value === "object") {
            collectOriginalStrings(value, `${prefix}${key}.`);
          }
        }
      }
    }
    collectOriginalStrings(parsedResult);

    // Apply unit preferences
    const unitPreferences: UnitPreferences = {
      queryOverrides,
      blockTypes,
      dimensions,
      originalStrings,
    };

    const formatted = await formatQueryResult(parsedResult, unitPreferences);
    return formatted;
  } catch (error: any) {
    // WASM errors might not be properly propagated, check if it's a string error
    const errorMessage = error?.message || error?.toString() || String(error);
    throw new Error(`WASM query failed: ${errorMessage}`);
  }
}
