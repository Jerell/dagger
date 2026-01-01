import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "@tanstack/react-db";
import { FlowNetwork } from "@/components/flow/flow-network";
import {
  loadPresetFromApi,
  nodesCollection,
  edgesCollection,
} from "@/lib/collections/flow";
import { networkQueryOptions } from "@/lib/api-client";

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

  const { data: nodes = [] } = useLiveQuery(nodesCollection);
  const { data: edges = [] } = useLiveQuery(edgesCollection);

  return (
    <div className="flex flex-col bg-brand-white border border-brand-grey-3 h-full">
      <div className="p-4 border-b border-brand-grey-3">
        <h1 className="text-3xl">{label}</h1>
      </div>
      <div className="flex-1 min-h-0">
        <FlowNetwork nodes={nodes} edges={edges} />
      </div>
    </div>
  );
}
