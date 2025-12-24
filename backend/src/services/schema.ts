import init, { DaggerWasm } from '../pkg/dagger.js';

let wasmInitialized = false;
let daggerWasm: DaggerWasm | null = null;

async function ensureWasmInitialized() {
  if (!wasmInitialized) {
    await init();
    daggerWasm = new DaggerWasm();
    wasmInitialized = true;
  }
  return daggerWasm!;
}

export async function getSchemas(schemasDir: string): Promise<any> {
  const wasm = await ensureWasmInitialized();
  const result = wasm.get_schema_versions(schemasDir);
  return JSON.parse(result);
}

export async function getSchema(schemasDir: string, version: string): Promise<any> {
  const wasm = await ensureWasmInitialized();
  const result = wasm.get_schemas(schemasDir, version);
  return JSON.parse(result);
}

export async function validateBlock(
  schemasDir: string,
  version: string,
  blockType: string,
  block: any
): Promise<any> {
  const wasm = await ensureWasmInitialized();
  const blockJson = JSON.stringify(block);
  const result = wasm.validate_block(schemasDir, version, blockType, blockJson);
  return JSON.parse(result);
}

