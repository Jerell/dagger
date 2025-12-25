import { DaggerWasm } from "../../pkg/dagger.js";
import * as path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs/promises";
import { formatValue, UnitPreferences } from "./unitFormatter";
import { parseUnitPreferences } from "./query";
import dim from "./dim";

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
  return path.resolve(process.cwd(), relativePath);
}

export async function getSchemas(schemasDir: string): Promise<any> {
  const wasm = getWasm();
  const absolutePath = resolvePath(schemasDir);
  const result = wasm.get_schema_versions(absolutePath);
  return JSON.parse(result);
}

export async function getSchema(
  schemasDir: string,
  version: string
): Promise<any> {
  const wasm = getWasm();
  const absolutePath = resolvePath(schemasDir);
  const result = wasm.get_schemas(absolutePath, version);
  return JSON.parse(result);
}

export async function validateBlock(
  schemasDir: string,
  version: string,
  blockType: string,
  block: any
): Promise<any> {
  const wasm = getWasm();
  const absolutePath = resolvePath(schemasDir);
  const blockJson = JSON.stringify(block);
  const result = wasm.validate_block(
    absolutePath,
    version,
    blockType,
    blockJson
  );
  return JSON.parse(result);
}

export async function getNetworkSchemas(
  networkPath: string,
  schemasDir: string,
  version: string
): Promise<any> {
  const wasm = getWasm();

  // Read network files
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  // Read schema files
  const schemaFiles = await readSchemaFiles(schemasDir, version);
  const schemaFilesJson = JSON.stringify(schemaFiles);

  const result = wasm.get_network_schemas(
    filesJson,
    configContent || undefined,
    schemaFilesJson,
    version
  );
  return JSON.parse(result);
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

export async function getBlockSchemaProperties(
  networkPath: string,
  query: string,
  schemasDir: string,
  version: string
): Promise<any> {
  const wasm = getWasm();

  // Read network files
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  // Read schema files
  const schemaFiles = await readSchemaFiles(schemasDir, version);
  const schemaFilesJson = JSON.stringify(schemaFiles);

  const result = wasm.get_block_schema_properties(
    filesJson,
    configContent || undefined,
    query,
    schemaFilesJson,
    version
  );
  return JSON.parse(result);
}

async function readSchemaFiles(
  schemasDir: string,
  version: string
): Promise<Record<string, string>> {
  const absolutePath = resolvePath(schemasDir);
  const versionDir = path.join(absolutePath, version);
  const files: Record<string, string> = {};

  // Read all JSON files in the version directory
  const entries = await fs.readdir(versionDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      const filePath = path.join(versionDir, entry.name);
      const content = await fs.readFile(filePath, "utf-8");
      files[entry.name] = content;
    }
  }

  return files;
}

/**
 * Format validation results by applying unit preferences to value fields
 */
async function formatValidationResults(
  validationResults: Record<string, any>,
  networkPath: string,
  schemasDir: string,
  version: string,
  configContent: string | null
): Promise<Record<string, any>> {
  // Initialize dim library for unit conversions
  await dim.init();

  const wasm = getWasm();
  const { files } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  // Parse unit preferences from config
  const { blockTypes, dimensions, propertyDimensions } =
    parseUnitPreferences(configContent);

  const unitPreferences: UnitPreferences = {
    blockTypes,
    dimensions,
    propertyDimensions,
  };

  const formatted: Record<string, any> = {};

  for (const [propertyPath, validation] of Object.entries(validationResults)) {
    // Parse path like "branch-1/blocks/2/length"
    const pathParts = propertyPath.split("/");
    if (pathParts.length < 4 || pathParts[1] !== "blocks") {
      // Not a block property path, keep as-is
      formatted[propertyPath] = validation;
      continue;
    }

    const branchName = pathParts[0];
    const blockIndex = parseInt(pathParts[2], 10);
    const propertyName = pathParts[3];

    // Get block type by querying the network
    let blockType: string | undefined;
    try {
      const blockQuery = `${branchName}/blocks/${blockIndex}`;
      const blockResult = wasm.query_from_files(
        filesJson,
        configContent || undefined,
        blockQuery
      );
      const block = JSON.parse(blockResult);
      blockType = block.type;
    } catch {
      // Block query failed, continue without block type
    }

    // Get property metadata from schema (including constraints)
    let propertyMetadata: {
      dimension?: string;
      defaultUnit?: string;
      min?: number;
      max?: number;
    } | undefined;
    if (blockType && propertyName) {
      try {
        const schemaQuery = `${branchName}/blocks/${blockIndex}`;
        const schemaProperties = await getBlockSchemaProperties(
          networkPath,
          schemaQuery,
          schemasDir,
          version
        );
        const propertyKey = `${schemaQuery}/${propertyName}`;
        if (schemaProperties[propertyKey]) {
          const propInfo = schemaProperties[propertyKey];
          propertyMetadata = {
            dimension: propInfo.dimension,
            defaultUnit: propInfo.defaultUnit,
            min: propInfo.min,
            max: propInfo.max,
          };
        }
      } catch {
        // Schema lookup failed, continue without metadata
      }
    }

    // If no schema metadata, try config dimension map
    if (!propertyMetadata?.dimension && propertyDimensions[propertyName]) {
      propertyMetadata = {
        dimension: propertyDimensions[propertyName],
      };
    }

    // Format the validation result
    const formattedValidation = { ...validation };

    // Format the value if it exists and is a string (unit string)
    let originalValueString: string | undefined;
    if (formattedValidation.value && typeof formattedValidation.value === "string") {
      originalValueString = formattedValidation.value;
      const unitStringMatch = formattedValidation.value.match(
        /^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+(.+)$/
      );
      if (unitStringMatch) {
        const numericValue = parseFloat(unitStringMatch[1]);
        const originalKey = `_${propertyName}_original`;
        const formatPrefs: UnitPreferences = {
          ...unitPreferences,
          originalStrings: {
            ...unitPreferences.originalStrings,
            [originalKey]: formattedValidation.value,
          },
        };
        try {
          formattedValidation.value = await formatValue(
            numericValue,
            propertyName,
            blockType,
            formatPrefs,
            propertyMetadata
          );
        } catch {
          // Formatting failed, keep original value
        }
      }
    }

    // Re-validate constraints with proper unit conversion if we have defaultUnit
    if (
      propertyMetadata?.defaultUnit &&
      (propertyMetadata.min !== undefined || propertyMetadata.max !== undefined) &&
      originalValueString &&
      formattedValidation.is_valid !== false // Only re-validate if not already marked invalid
    ) {
      try {
        // Convert the original value to the defaultUnit for comparison
        const valueInDefaultUnit = dim.eval(
          `${originalValueString} as ${propertyMetadata.defaultUnit}`
        );
        const numericValue = parseFloat(valueInDefaultUnit.split(" ")[0]);

        // Check min constraint
        if (propertyMetadata.min !== undefined && numericValue < propertyMetadata.min) {
          formattedValidation.is_valid = false;
          formattedValidation.severity = "error";
          formattedValidation.message = `Value ${numericValue} ${propertyMetadata.defaultUnit} is less than minimum ${propertyMetadata.min} ${propertyMetadata.defaultUnit}`;
        }

        // Check max constraint
        if (
          formattedValidation.is_valid !== false &&
          propertyMetadata.max !== undefined &&
          numericValue > propertyMetadata.max
        ) {
          formattedValidation.is_valid = false;
          formattedValidation.severity = "error";
          formattedValidation.message = `Value ${numericValue} ${propertyMetadata.defaultUnit} is greater than maximum ${propertyMetadata.max} ${propertyMetadata.defaultUnit}`;
        }
      } catch (error) {
        // Unit conversion failed, skip constraint validation
        // The Rust validation will have caught basic issues
      }
    }

    formatted[propertyPath] = formattedValidation;
  }

  return formatted;
}

export async function validateQueryBlocks(
  networkPath: string,
  query: string,
  schemasDir: string,
  version: string
): Promise<any> {
  const wasm = getWasm();

  // Read network files
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  // Read schema files
  const schemaFiles = await readSchemaFiles(schemasDir, version);
  const schemaFilesJson = JSON.stringify(schemaFiles);

  const result = wasm.validate_query_blocks(
    filesJson,
    configContent || undefined,
    query,
    schemaFilesJson,
    version
  );
  const validationResults = JSON.parse(result);

  // Format validation results with unit preferences
  return await formatValidationResults(
    validationResults,
    networkPath,
    schemasDir,
    version,
    configContent
  );
}

export async function validateNetworkBlocks(
  networkPath: string,
  schemasDir: string,
  version: string
): Promise<any> {
  const wasm = getWasm();

  // Read network files
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  // Read schema files
  const schemaFiles = await readSchemaFiles(schemasDir, version);
  const schemaFilesJson = JSON.stringify(schemaFiles);

  const result = wasm.validate_network_blocks(
    filesJson,
    configContent || undefined,
    schemaFilesJson,
    version
  );
  const validationResults = JSON.parse(result);

  // Format validation results with unit preferences
  return await formatValidationResults(
    validationResults,
    networkPath,
    schemasDir,
    version,
    configContent
  );
}
