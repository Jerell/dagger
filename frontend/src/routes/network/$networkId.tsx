import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  networkQueryOptions,
  type NetworkNode,
  type NetworkEdge,
} from "@frontend/lib/api-client";
import { FlowNetwork } from "@/components/flow/flow-network";

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

function sortObjectKeys<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys) as unknown as T;
  }
  const sorted = {} as T;
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  for (const key of keys) {
    (sorted as Record<string, unknown>)[key] = sortObjectKeys(
      (obj as Record<string, unknown>)[key]
    );
  }
  return sorted;
}

function getNodeKey(node: NetworkNode, index: number): string {
  if (typeof node === "object" && node !== null) {
    const idFields = ["id", "nodeId", "key"];
    for (const field of idFields) {
      if (
        field in node &&
        typeof (node as Record<string, unknown>)[field] === "string"
      ) {
        return String((node as Record<string, unknown>)[field]);
      }
    }
  }
  return `node-${index}-${JSON.stringify(node).slice(0, 50)}`;
}

function getEdgeKey(edge: NetworkEdge, index: number): string {
  if (edge.source && edge.target) {
    return `${edge.source}->${edge.target}`;
  }
  return `edge-${index}`;
}

function sortNodes(nodes: NetworkNode[]): NetworkNode[] {
  return [...nodes].sort((a, b) => {
    const keyA = getNodeKey(a, 0);
    const keyB = getNodeKey(b, 0);
    return keyA.localeCompare(keyB);
  });
}

function sortEdges(edges: NetworkEdge[]): NetworkEdge[] {
  return [...edges].sort((a, b) => {
    const keyA = getEdgeKey(a, 0);
    const keyB = getEdgeKey(b, 0);
    return keyA.localeCompare(keyB);
  });
}

function SpecificNetwork() {
  const { networkId } = Route.useParams();
  const { label } = Route.useLoaderData();
  const networkQuery = useSuspenseQuery(networkQueryOptions(networkId));
  const network = networkQuery.data;

  const sortedNodes = network.nodes ? sortNodes(network.nodes) : [];
  const sortedEdges = network.edges ? sortEdges(network.edges) : [];

  return (
    <div className="flex flex-col bg-brand-white border border-brand-grey-3 h-full">
      <h1 className="text-3xl">{label}</h1>
      <FlowNetwork />
      <div className="w-full p-1">
        <div className="mb-6">
          <h2 className="text-2xl">Nodes ({sortedNodes.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto border-y border-brand-grey-3 relative">
            {sortedNodes.map((node: NetworkNode, index: number) => (
              <div
                key={getNodeKey(node, index)}
                className="border-x border-brand-grey-3"
              >
                <p className="sticky top-0 bg-brand-grey-1">
                  {node.id ?? node.type}
                </p>
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(sortObjectKeys(node), null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
