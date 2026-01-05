import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "@tanstack/react-db";
import { FlowNetwork } from "@/components/flow/flow-network";
import {
  loadPresetFromApi,
  nodesCollection,
  edgesCollection,
  sortNodesWithParentsFirst,
} from "@/lib/collections/flow";
import { networkQueryOptions } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportNetworkToToml } from "@/lib/exporters/toml-exporter";
import { pickNetworkDirectory } from "@/lib/tauri";

export const Route = createFileRoute("/network/$networkId")({
  loader: async ({ context, params }) => {
    const { networkId } = params;
    const network = await context.queryClient.ensureQueryData(
      networkQueryOptions(networkId)
    );
    // Load preset into collections using the already-fetched network data
    await loadPresetFromApi(network);
    return { networkId, label: network.label };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.label || loaderData?.networkId || "Network"}`,
      },
    ],
  }),
  component: SpecificNetwork,
});

function SpecificNetwork() {
  const { label } = Route.useLoaderData();
  const [isExporting, setIsExporting] = useState(false);

  const { data: nodesRaw = [] } = useLiveQuery(nodesCollection);
  const { data: edges = [] } = useLiveQuery(edgesCollection);

  // Sort nodes so parents come before children (ReactFlow requirement)
  // Collections don't preserve order, so we need to sort when reading
  const nodes = useMemo(() => sortNodesWithParentsFirst(nodesRaw), [nodesRaw]);

  const handleExport = async () => {
    if (nodes.length === 0) {
      // TODO: Show toast - no nodes to export
      return;
    }

    setIsExporting(true);
    try {
      // Let user select directory
      const selectedPath = await pickNetworkDirectory();
      if (!selectedPath) {
        return; // User cancelled
      }

      await exportNetworkToToml(nodes, edges, selectedPath);
      // TODO: Show success toast
      console.log("Network exported successfully to:", selectedPath);
    } catch (error) {
      console.error("Failed to export network:", error);
      // TODO: Show error toast
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-brand-white border border-brand-grey-3">
      <div className="p-4 border-b border-brand-grey-3 flex items-center justify-between">
        <h1 className="text-3xl">{label}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting || nodes.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <FlowNetwork nodes={nodes} edges={edges} />
      </div>
    </div>
  );
}
