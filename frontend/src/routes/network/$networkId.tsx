import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { networkQueryOptions } from "@frontend/lib/api-client";
import { FlowNetwork } from "@/components/flow/flow-network";
import type { Node, Edge } from "@xyflow/react";

export const Route = createFileRoute("/network/$networkId")({
  loader: async ({ context, params }) => {
    const { networkId } = params;
    const network = await context.queryClient.ensureQueryData(
      networkQueryOptions(networkId)
    );
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
  const { networkId } = Route.useParams();
  const { label } = Route.useLoaderData();
  const networkQuery = useSuspenseQuery(networkQueryOptions(networkId));
  const network = networkQuery.data;

  // Cast API response to ReactFlow types (Rust already outputs ReactFlow-compatible structures)
  const nodes = (network.nodes || []) as Node[];
  const edges = (network.edges || []) as Edge[];

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
