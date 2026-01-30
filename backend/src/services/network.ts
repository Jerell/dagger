import * as path from "path";
import * as fs from "fs/promises";
import { getDagger } from "../utils/getDagger";

function resolvePath(relativePath: string): string {
  // If path is already absolute, use it as-is
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  // Otherwise, resolve relative to process.cwd() which should be the backend directory
  // when the server is running
  return path.resolve(process.cwd(), relativePath);
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

export async function loadNetwork(networkPath: string): Promise<any> {
  const dagger = getDagger();
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);
  const result = dagger.load_network_from_files(
    filesJson,
    configContent || undefined,
  );
  const network = JSON.parse(result);

  // Derive network ID from path (last directory segment)
  const networkId = networkPath.split("/").pop() || "unknown";
  network.id = networkId;

  return network;
}

export async function getNetworkNodes(
  networkPath: string,
  nodeType?: string,
): Promise<any[]> {
  const network = await loadNetwork(networkPath);
  const nodes = network.nodes || [];

  if (nodeType) {
    return nodes.filter((n: any) => n?.type === nodeType);
  }

  return nodes;
}

export async function getNetworkEdges(
  networkPath: string,
  source?: string,
  target?: string,
): Promise<any[]> {
  // For now, load the full network and filter in Node.js
  // TODO: Add get_edges_from_files to WASM bindings
  const network = await loadNetwork(networkPath);
  const edges = network.edges || [];

  return edges.filter((e: any) => {
    if (source && e.source !== source) return false;
    if (target && e.target !== target) return false;
    return true;
  });
}
