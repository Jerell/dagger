import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  networkQueryOptions,
  type NetworkNode,
  type NetworkEdge,
} from "@frontend/lib/api-client";

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
    if ("branchNode" in node) {
      const branchNode = (node as { branchNode?: { id?: string } }).branchNode;
      if (branchNode?.id) {
        return branchNode.id;
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
  const networkQuery = useSuspenseQuery(networkQueryOptions(networkId));
  const network = networkQuery.data;

  const sortedNodes = network.nodes ? sortNodes(network.nodes) : [];
  const sortedEdges = network.edges ? sortEdges(network.edges) : [];

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4 text-white"
      style={{
        backgroundColor: "#000",
        backgroundImage:
          "radial-gradient(ellipse 60% 60% at 0% 100%, #444 0%, #222 60%, #000 100%)",
      }}
    >
      <div className="w-full max-w-4xl p-8 rounded-xl backdrop-blur-md bg-black/50 shadow-xl border-8 border-black/10">
        <h1 className="text-3xl mb-6 font-bold">Network: {networkId}</h1>

        <div className="mb-6">
          <h2 className="text-2xl mb-4">Nodes ({sortedNodes.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sortedNodes.map((node: NetworkNode, index: number) => (
              <div
                key={getNodeKey(node, index)}
                className="bg-white/10 border border-white/20 rounded-lg p-3 backdrop-blur-sm shadow-md"
              >
                <pre className="text-sm text-white overflow-x-auto">
                  {JSON.stringify(sortObjectKeys(node), null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-2xl mb-4">Edges ({sortedEdges.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sortedEdges.map((edge: NetworkEdge, index: number) => (
              <div
                key={getEdgeKey(edge, index)}
                className="bg-white/10 border border-white/20 rounded-lg p-3 backdrop-blur-sm shadow-md"
              >
                <div className="text-white">
                  <span className="font-semibold">{edge.source}</span> →{" "}
                  <span className="font-semibold">{edge.target}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
