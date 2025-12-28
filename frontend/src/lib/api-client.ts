import type { App } from "@backend/index";
import { hc } from "hono/client";
import { getApiBaseUrl } from "./api-proxy";

export type NetworkResponse = {
  id: string;
  label: string;
  nodes: Array<Record<string, unknown>>;
  edges: Array<{
    source: string;
    target: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

type HonoClient = {
  api: {
    network: {
      $get: (options: { query: { network: string } }) => Promise<Response>;
      nodes: {
        $get: (options: {
          query: { network: string; type?: string };
        }) => Promise<Response>;
      };
      edges: {
        $get: (options: {
          query: { network: string; source?: string; target?: string };
        }) => Promise<Response>;
      };
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function createClient(): HonoClient {
  const baseUrl = getApiBaseUrl();
  // @ts-expect-error - Hono RPC type constraints are strict, but runtime is type-safe
  return hc<App>(baseUrl) as unknown as HonoClient;
}

export function getClient(): HonoClient {
  return createClient();
}

export async function getNetwork(networkId: string): Promise<NetworkResponse> {
  const client = getClient();
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

  return response.json() as Promise<NetworkResponse>;
}

export async function getNetworkNodes(networkId: string, nodeType?: string) {
  const client = getClient();
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

export type NetworkNode = NetworkResponse extends { nodes: infer N }
  ? N extends Array<infer T>
    ? T
    : never
  : never;

export type NetworkEdge = NetworkResponse extends { edges: infer E }
  ? E extends Array<infer T>
    ? T
    : never
  : never;
