import { DaggerWasm } from "../../pkg/dagger.js";
import * as path from "path";
import { fileURLToPath } from "url";

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
