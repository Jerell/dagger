import { DaggerWasm } from "../../pkg/dagger.js";
import * as path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs/promises";

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
