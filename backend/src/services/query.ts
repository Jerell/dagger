import { DaggerWasm } from "../../pkg/dagger.js";
import * as path from "path";
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

export async function queryNetwork(
  networkPath: string,
  query: string
): Promise<any> {
  const wasm = getWasm();

  // Read files in Node.js and pass contents to WASM
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);

  try {
    const result = wasm.query_from_files(
      filesJson,
      configContent || undefined,
      query
    );
    return JSON.parse(result);
  } catch (error: any) {
    // WASM errors might not be properly propagated, check if it's a string error
    const errorMessage = error?.message || error?.toString() || String(error);
    throw new Error(`WASM query failed: ${errorMessage}`);
  }
}
