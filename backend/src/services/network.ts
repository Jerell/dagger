import * as path from "path";
import * as fs from "fs/promises";
import { getDagger } from "../utils/getDagger";
import type { JsonObject, JsonValue } from "./json";

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

export type NetworkNode = JsonObject & {
  id?: string;
  type?: string;
};

export type NetworkEdge = JsonObject & {
  id?: string;
  source?: string;
  target?: string;
};

export type LoadedNetwork = JsonObject & {
  id: string;
  nodes?: NetworkNode[];
  edges?: NetworkEdge[];
};

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function loadNetwork(networkPath: string): Promise<LoadedNetwork> {
  const dagger = getDagger();
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);
  const result = dagger.load_network_from_files(
    filesJson,
    configContent || undefined,
  );
  const parsed = JSON.parse(result) as JsonValue;
  if (!isJsonObject(parsed)) {
    throw new Error("Expected network JSON object from WASM");
  }

  // Derive network ID from path (last directory segment)
  const networkId = networkPath.split("/").pop() || "unknown";
  return {
    ...parsed,
    id: networkId,
    nodes: Array.isArray(parsed.nodes)
      ? parsed.nodes.filter(isJsonObject)
      : undefined,
    edges: Array.isArray(parsed.edges)
      ? parsed.edges.filter(isJsonObject)
      : undefined,
  };
}

export async function getNetworkNodes(
  networkPath: string,
  nodeType?: string,
): Promise<NetworkNode[]> {
  const network = await loadNetwork(networkPath);
  const nodes = network.nodes || [];

  if (nodeType) {
    return nodes.filter((node) => node.type === nodeType);
  }

  return nodes;
}

export async function getNetworkEdges(
  networkPath: string,
  source?: string,
  target?: string,
): Promise<NetworkEdge[]> {
  // For now, load the full network and filter in Node.js
  // TODO: Add get_edges_from_files to WASM bindings
  const network = await loadNetwork(networkPath);
  const edges = network.edges || [];

  return edges.filter((edge) => {
    if (source && edge.source !== source) return false;
    if (target && edge.target !== target) return false;
    return true;
  });
}
