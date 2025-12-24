import { Hono } from "hono";
import {
  loadNetwork,
  getNetworkNodes,
  getNetworkEdges,
} from "../services/network";

export const networkRoutes = new Hono();

/**
 * GET /api/network
 * Get the full network structure
 *
 * Query params:
 * - network: Path to the network directory (default: "../network/preset1")
 */
networkRoutes.get("/", async (c) => {
  const networkPath = c.req.query("network") || "../network/preset1";

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
 * - network: Path to the network directory (default: "../network/preset1")
 * - type: Filter by node type (optional)
 */
networkRoutes.get("/nodes", async (c) => {
  const networkPath = c.req.query("network") || "../network/preset1";
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
 * - network: Path to the network directory (default: "../network/preset1")
 * - source: Filter by source node ID (optional)
 * - target: Filter by target node ID (optional)
 */
networkRoutes.get("/edges", async (c) => {
  const networkPath = c.req.query("network") || "../network/preset1";
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
