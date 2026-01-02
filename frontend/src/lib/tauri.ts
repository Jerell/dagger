import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface NetworkFile {
  path: string;
  content: string;
}

export interface OperationsServerConfig {
  costing_url?: string | null;
  modelling_url?: string | null;
}

/**
 * Start the local server (Bun + Hono)
 * @param backendPath Path to the backend directory
 * @returns Server URL
 */
export async function startLocalServer(backendPath: string): Promise<string> {
  return await invoke<string>("start_local_server", { backendPath });
}

/**
 * Stop the local server
 */
export async function stopLocalServer(): Promise<void> {
  return await invoke<void>("stop_local_server");
}

/**
 * Pick a network directory using native file dialog
 * @returns Selected directory path or null
 */
export async function pickNetworkDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Network Directory",
  });

  return Array.isArray(selected) ? selected[0] : selected;
}

/**
 * Read all TOML files from a network directory
 * @param path Directory path
 * @returns Array of network files
 */
export async function readNetworkDirectory(
  path: string
): Promise<NetworkFile[]> {
  return await invoke<NetworkFile[]>("read_network_directory", { path });
}

/**
 * Write a network file (TOML)
 * @param path File path
 * @param content File content
 */
export async function writeNetworkFile(
  path: string,
  content: string
): Promise<void> {
  return await invoke<void>("write_network_file", { path, content });
}

/**
 * Delete a network file
 * @param path File path
 */
export async function deleteNetworkFile(path: string): Promise<void> {
  return await invoke<void>("delete_network_file", { path });
}

/**
 * Start watching a directory for TOML file changes
 * @param path Directory path to watch
 * @returns Promise that resolves when watching starts
 */
export async function startWatchingDirectory(path: string): Promise<void> {
  return await invoke<void>("start_watching_directory", { path });
}

/**
 * Stop watching the current directory
 */
export async function stopWatchingDirectory(): Promise<void> {
  return await invoke<void>("stop_watching_directory");
}

/**
 * Get operations server configuration
 * @returns Operations server URLs
 */
export async function getOperationsConfig(): Promise<OperationsServerConfig> {
  return await invoke<OperationsServerConfig>("get_operations_config");
}

