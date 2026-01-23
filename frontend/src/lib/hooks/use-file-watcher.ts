import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import {
  startWatchingDirectory,
  stopWatchingDirectory,
} from "@/lib/tauri";
import { getNetworkFromPath } from "@/lib/api-client";
import { resetFlowToNetwork } from "@/lib/collections/flow";

export type WatchModeState = {
  enabled: boolean;
  directoryPath: string | null;
  isWatching: boolean;
};

/**
 * Hook to manage file watching for network TOML files
 * When enabled, watches a directory for changes and auto-updates the network
 */
export function useFileWatcher() {
  const queryClient = useQueryClient();
  const [watchMode, setWatchMode] = useState<WatchModeState>({
    enabled: false,
    directoryPath: null,
    isWatching: false,
  });

  // Listen for file change events from Tauri
  useEffect(() => {
    if (!watchMode.enabled || !watchMode.directoryPath) return;

    const unlisten = listen<string[]>("file-changed", async (event) => {
      const changedPaths = event.payload;
      console.log("File changed:", changedPaths);

      try {
        // Reload network from the watched directory
        const network = await getNetworkFromPath(watchMode.directoryPath!);

        // Update collections with the new network data
        await resetFlowToNetwork(network);

        // Invalidate operation queries so they refetch with updated network data
        // This ensures costing validation reflects the latest file changes
        await queryClient.invalidateQueries({ queryKey: ["costing", "validation"] });
        await queryClient.invalidateQueries({ queryKey: ["schema", "validation"] });

        console.log("Network reloaded from file changes");
      } catch (error) {
        console.error("Error reloading network after file change:", error);
        // TODO: Show error toast to user
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [watchMode.enabled, watchMode.directoryPath, queryClient]);

  const enableWatchMode = useCallback(async (directoryPath: string) => {
    try {
      // Start watching the directory
      await startWatchingDirectory(directoryPath);
      
      // Load the network from the directory initially
      const network = await getNetworkFromPath(directoryPath);
      await resetFlowToNetwork(network);
      
      setWatchMode({
        enabled: true,
        directoryPath,
        isWatching: true,
      });
    } catch (error) {
      console.error("Failed to start watching directory:", error);
      throw error;
    }
  }, []);

  const disableWatchMode = useCallback(async () => {
    try {
      await stopWatchingDirectory();
      setWatchMode({
        enabled: false,
        directoryPath: null,
        isWatching: false,
      });
    } catch (error) {
      console.error("Failed to stop watching directory:", error);
      throw error;
    }
  }, []);

  return {
    watchMode,
    enableWatchMode,
    disableWatchMode,
    // ReactFlow editing should be disabled when watch mode is enabled
    nodesDraggable: !watchMode.enabled,
    nodesConnectable: !watchMode.enabled,
    elementsSelectable: !watchMode.enabled,
  };
}

