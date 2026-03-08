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
  // Extra properties from TOML (e.g., pressure, length, diameter)
  [key: string]: string | number | boolean | null | undefined;
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

export type ImageNodeData = {
  id: string;
  label?: string | null;
  // Path to the image file, relative to the network directory
  path: string;
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

// Image node - displays an image/SVG in the flow
export type ImageNode = BaseNodeProperties & {
  type: "image";
  data: ImageNodeData;
};

// Union type for all node types
export type NetworkNode =
  | BranchNode
  | GroupNode
  | GeographicAnchorNode
  | GeographicWindowNode
  | ImageNode;

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

async function apiGet<T>(
  path: string,
  query?: Record<string, string | undefined>,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = new URL(path, baseUrl);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        "Backend server is not running. Please ensure the backend server is started.",
      );
    }
    throw error;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Unknown error",
      status: response.status,
    }));
    throw new Error(
      error.message ||
        error.error ||
        `Request failed with status ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function getNetwork(networkId: string): Promise<NetworkResponse> {
  return apiGet<NetworkResponse>("/api/network", { network: networkId });
}

export async function getNetworkNodes(networkId: string, nodeType?: string) {
  return apiGet<unknown[]>("/api/network/nodes", {
    network: networkId,
    type: nodeType,
  });
}

export async function getNetworkEdges(
  networkId: string,
  source?: string,
  target?: string
) {
  return apiGet<unknown[]>("/api/network/edges", {
    network: networkId,
    source,
    target,
  });
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

/**
 * Get network from an absolute directory path or preset name
 * @param networkIdentifier Either a preset name (e.g., "preset1") or an absolute path to directory containing TOML files
 */
export async function getNetworkFromPath(
  networkIdentifier: string
): Promise<NetworkResponse> {
  // The unified API now accepts absolute paths via the network parameter
  return getNetwork(networkIdentifier);
}

export async function getAvailablePresets(): Promise<
  Array<{ id: string; label: string }>
> {
  return apiGet<Array<{ id: string; label: string }>>("/api/network/list");
}

export function presetsQueryOptions() {
  return {
    queryKey: ["presets"] as const,
    queryFn: () => getAvailablePresets(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  };
}
