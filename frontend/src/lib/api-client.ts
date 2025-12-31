import type { App } from "@backend/index";
import { hc } from "hono/client";
import { getApiBaseUrl } from "./api-proxy";

// Define proper types for network data structures matching Rust serialization

export type Position = {
  x: number;
  y: number;
};

export type Block = {
  quantity: number;
  type: string;
  kind: string;
  label: string;
};

// Base node properties that all nodes have
export type BaseNodeProperties = {
  id: string;
  type: string;
  position: Position;
  parentId?: string | null;
  extent?: "parent";
  width?: number | null;
  height?: number | null;
};

// Data structures for different node types
export type BranchNodeData = {
  id: string;
  label: string;
  blocks: Block[];
};

export type GroupNodeData = {
  id: string;
  label?: string | null;
  // Additional properties from extra HashMap (e.g., pressure, efficiency)
  [key: string]: string | number | boolean | null | undefined;
};

export type GeographicNodeData = {
  id: string;
  label?: string | null;
  // Additional properties from extra HashMap
  [key: string]: string | number | boolean | null | undefined;
};

// Branch node - has custom serialization with data property
export type BranchNode = BaseNodeProperties & {
  type: "branch";
  data: BranchNodeData;
};

// Group node - now has data property with extra fields
export type GroupNode = BaseNodeProperties & {
  type: "labeledGroup";
  data: GroupNodeData;
};

// Geographic nodes - now have data property
export type GeographicAnchorNode = BaseNodeProperties & {
  type: "geographicAnchor";
  data: GeographicNodeData;
};

export type GeographicWindowNode = BaseNodeProperties & {
  type: "geographicWindow";
  data: GeographicNodeData;
};

// Union type for all node types
export type NetworkNode =
  | BranchNode
  | GroupNode
  | GeographicAnchorNode
  | GeographicWindowNode;

export type EdgeData = {
  weight: number;
};

export type NetworkEdge = {
  id: string;
  source: string;
  target: string;
  data: EdgeData;
};

export type NetworkResponse = {
  id: string;
  label: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
};

// Create client helper following Hono RPC documentation pattern
// See: https://hono.dev/docs/guides/rpc
// Using a const helper to help TypeScript infer the type correctly
const createHonoClient = (baseUrl: string) => hc<App>(baseUrl);

// Pre-calculate client type at compile time (recommended for monorepos)
// This helps TypeScript resolve types correctly
// Note: TypeScript may show errors due to bundler mode limitations in monorepos,
// but the types are correct at runtime
export type Client = ReturnType<typeof createHonoClient>;

// Create a typed client - Hono RPC will properly infer types from App
export function getClient(): Client {
  const baseUrl = getApiBaseUrl();
  return createHonoClient(baseUrl);
}

export async function getNetwork(networkId: string): Promise<NetworkResponse> {
  const client = getClient();
  // @ts-expect-error - TypeScript limitation with bundler mode in monorepos
  // The client type is correctly inferred at runtime via Hono RPC
  const response = await client.api.network.$get({
    query: { network: networkId },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Unknown error",
      status: response.status,
    }));
    throw new Error(
      error.message ||
        error.error ||
        `Request failed with status ${response.status}`
    );
  }

  return (await response.json()) as NetworkResponse;
}

export async function getNetworkNodes(networkId: string, nodeType?: string) {
  const client = getClient();
  // @ts-expect-error - TypeScript limitation with bundler mode in monorepos
  // The client type is correctly inferred at runtime via Hono RPC
  const response = await client.api.network.nodes.$get({
    query: { network: networkId, ...(nodeType && { type: nodeType }) },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Unknown error",
      status: response.status,
    }));
    throw new Error(
      error.message ||
        error.error ||
        `Request failed with status ${response.status}`
    );
  }

  return response.json();
}

export async function getNetworkEdges(
  networkId: string,
  source?: string,
  target?: string
) {
  const client = getClient();
  // @ts-expect-error - TypeScript limitation with bundler mode in monorepos
  // The client type is correctly inferred at runtime via Hono RPC
  const response = await client.api.network.edges.$get({
    query: {
      network: networkId,
      ...(source && { source }),
      ...(target && { target }),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Unknown error",
      status: response.status,
    }));
    throw new Error(
      error.message ||
        error.error ||
        `Request failed with status ${response.status}`
    );
  }

  return response.json();
}

export function networkQueryOptions(networkId: string) {
  return {
    queryKey: ["network", networkId] as const,
    queryFn: () => getNetwork(networkId),
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  };
}

// NetworkNode and NetworkEdge are already defined above
