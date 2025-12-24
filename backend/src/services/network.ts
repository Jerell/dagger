import init, { DaggerWasm } from "../pkg/dagger.js";

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

export async function loadNetwork(networkPath: string): Promise<any> {
  const wasm = await ensureWasmInitialized();
  const result = wasm.load_network(networkPath);
  return JSON.parse(result);
}

export async function getNetworkNodes(
  networkPath: string,
  nodeType?: string
): Promise<any[]> {
  const wasm = await ensureWasmInitialized();
  const result = wasm.get_nodes(networkPath, nodeType || null);
  return JSON.parse(result);
}

export async function getNetworkEdges(
  networkPath: string,
  source?: string,
  target?: string
): Promise<any[]> {
  const wasm = await ensureWasmInitialized();
  const result = wasm.get_edges(networkPath, source || null, target || null);
  return JSON.parse(result);
}
