import { DaggerWasm } from "../../pkg/dagger";

// With nodejs target, WASM is initialized synchronously when module loads
let daggerWasm: DaggerWasm | null = null;

export function getDagger() {
  if (!daggerWasm) {
    daggerWasm = new DaggerWasm();
  }
  return daggerWasm;
}
