import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "@tanstack/react-db";
import { FlowNetwork } from "@/components/flow/flow-network";
import {
  nodesCollection,
  edgesCollection,
  sortNodesWithParentsFirst,
} from "@/lib/collections/flow";
import { useFileWatcher } from "@/lib/hooks/use-file-watcher";
import { openDialog } from "@/contexts/dialog-provider";
import { WatchDirectoryDialog } from "@/components/dialogs/watch-directory-dialog";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, FolderOpen } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/network/watch")({
  component: WatchPage,
});

function WatchPage() {
  const fileWatcher = useFileWatcher();

  const { data: nodesRaw = [] } = useLiveQuery(nodesCollection);
  const { data: edges = [] } = useLiveQuery(edgesCollection);

  // Sort nodes so parents come before children (ReactFlow requirement)
  const nodes = useMemo(() => sortNodesWithParentsFirst(nodesRaw), [nodesRaw]);

  const handleOpenWatchDialog = () => {
    openDialog(
      () => (
        <WatchDirectoryDialog
          onDirectorySelected={async (path) => {
            try {
              await fileWatcher.enableWatchMode(path);
            } catch (error) {
              console.error("Failed to enable watch mode:", error);
              // TODO: Show error toast
            }
          }}
        />
      ),
      {
        title: "Watch Network Directory",
        description: "Select a directory to watch for TOML file changes",
      }
    );
  };

  const handleDisableWatch = async () => {
    try {
      await fileWatcher.disableWatchMode();
    } catch (error) {
      console.error("Failed to disable watch mode:", error);
      // TODO: Show error toast
    }
  };

  return (
    <div className="flex flex-col bg-brand-white border border-brand-grey-3 h-full">
      <div className="p-4 border-b border-brand-grey-3 flex items-center justify-between">
        {fileWatcher.watchMode.enabled ? (
          <>
            <div className="flex flex-col">
              <h1 className="text-3xl">Watching Directory</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {fileWatcher.watchMode.directoryPath}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDisableWatch}>
              <EyeOff className="mr-2 h-4 w-4" />
              Stop Watching
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col">
              <h1 className="text-3xl">Watch Network Directory</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Select a directory to watch for TOML file changes
              </p>
            </div>
            <Button onClick={handleOpenWatchDialog}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Select Directory
            </Button>
          </>
        )}
      </div>
      {fileWatcher.watchMode.enabled ? (
        <div className="flex-1 min-h-0">
          <FlowNetwork
            nodes={nodes}
            edges={edges}
            nodesDraggable={fileWatcher.nodesDraggable}
            nodesConnectable={fileWatcher.nodesConnectable}
            elementsSelectable={fileWatcher.elementsSelectable}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h2 className="text-xl font-semibold">No Directory Selected</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Click "Select Directory" to choose a directory containing TOML
                network files.
              </p>
            </div>
            <Button onClick={handleOpenWatchDialog} size="lg">
              <FolderOpen className="mr-2 h-4 w-4" />
              Select Directory
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

