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

export async function queryNetwork(networkPath: string, query: string): Promise<any> {
  const wasm = await ensureWasmInitialized();
  const result = wasm.query(networkPath, query);
  return JSON.parse(result);
}

