import { Hono } from "hono";
import {
  loadNetwork,
  getNetworkNodes,
  getNetworkEdges,
} from "../services/network";

export const networkRoutes = new Hono();

/**
 * Define available networks
 * This is the source of truth for which networks are available via the API
 */
const AVAILABLE_NETWORKS = [
  { id: "preset1", label: "Preset 1" },
  // Add more networks here as they become available
] as const;

/**
 * GET /api/network
 * Get the full network structure
 *
 * Query params:
 * - network: Network name (default: "preset1") - looks in backend/networks/
 */
networkRoutes.get("/", async (c) => {
  const networkName = c.req.query("network") || "preset1";
  const networkPath = `networks/${networkName}`;

  try {
    const network = await loadNetwork(networkPath);
    return c.json(network);
  } catch (error) {
    return c.json(
      {
        error: "Failed to load network",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * GET /api/network/nodes
 * Get all nodes in the network
 *
 * Query params:
 * - network: Network name (default: "preset1") - looks in backend/networks/
 * - type: Filter by node type (optional)
 */
networkRoutes.get("/nodes", async (c) => {
  const networkName = c.req.query("network") || "preset1";
  const networkPath = `networks/${networkName}`;
  const nodeType = c.req.query("type");

  try {
    const nodes = await getNetworkNodes(networkPath, nodeType);
    return c.json(nodes);
  } catch (error) {
    return c.json(
      {
        error: "Failed to load nodes",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * GET /api/network/edges
 * Get all edges in the network
 *
 * Query params:
 * - network: Network name (default: "preset1") - looks in backend/networks/
 * - source: Filter by source node ID (optional)
 * - target: Filter by target node ID (optional)
 */
networkRoutes.get("/edges", async (c) => {
  const networkName = c.req.query("network") || "preset1";
  const networkPath = `networks/${networkName}`;
  const source = c.req.query("source");
  const target = c.req.query("target");

  try {
    const edges = await getNetworkEdges(networkPath, source, target);
    return c.json(edges);
  } catch (error) {
    return c.json(
      {
        error: "Failed to load edges",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * GET /api/network/list
 * List all available network presets
 * Returns the list of networks defined in AVAILABLE_NETWORKS
 */
networkRoutes.get("/list", async (c) => {
  // Optionally, we can enrich the list with labels from actual network files
  const networks = await Promise.all(
    AVAILABLE_NETWORKS.map(async (network) => {
      try {
        // Try to load the network to get its actual label
        const networkData = await loadNetwork(`networks/${network.id}`);
        return {
          id: network.id,
          label: networkData.label || network.label,
        };
      } catch (error) {
        // If network can't be loaded, use the configured label
        return network;
      }
    })
  );

  return c.json(networks);
});

/**
 * GET /api/network/from-path
 * Load network from an absolute directory path
 * 
 * Query params:
 * - path: Absolute directory path containing TOML files
 */
networkRoutes.get("/from-path", async (c) => {
  const directoryPath = c.req.query("path");
  
  console.log("[from-path] Request received, path:", directoryPath);
  
  if (!directoryPath) {
    return c.json(
      {
        error: "Missing path parameter",
        message: "The 'path' query parameter is required",
      },
      400
    );
  }

  try {
    console.log("[from-path] Loading network from:", directoryPath);
    // loadNetwork now supports absolute paths via resolvePath
    const network = await loadNetwork(directoryPath);
    console.log("[from-path] Network loaded successfully");
    return c.json(network);
  } catch (error) {
    console.error("[from-path] Error loading network:", error);
    return c.json(
      {
        error: "Failed to load network",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});
