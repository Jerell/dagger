"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/contexts/dialog-provider";
import { pickNetworkDirectory } from "@/lib/tauri";
import { Loader2 } from "lucide-react";

export function WatchDirectoryDialog({
  onDirectorySelected,
}: {
  onDirectorySelected: (path: string) => void;
}) {
  const dialog = useDialog();
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectDirectory = async () => {
    setIsSelecting(true);
    try {
      const selectedPath = await pickNetworkDirectory();
      if (selectedPath) {
        onDirectorySelected(selectedPath);
        dialog.close();
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
      // TODO: Show error toast
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Select a directory containing TOML network files. The app will watch
          this directory for changes and automatically update the network view.
        </p>
        <p className="text-xs text-muted-foreground">
          When watch mode is enabled, browser editing will be disabled. You
          must edit files directly in your editor.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={dialog.close}>
          Cancel
        </Button>
        <Button onClick={handleSelectDirectory} disabled={isSelecting}>
          {isSelecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Selecting...
            </>
          ) : (
            "Select Directory"
          )}
        </Button>
      </div>
    </div>
  );
}

