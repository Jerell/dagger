import { Hono } from "hono";
import * as fs from "fs/promises";
import * as path from "path";
import {
  loadNetwork,
  getNetworkNodes,
  getNetworkEdges,
} from "../services/network";
import { resolveNetworkPath } from "../utils/network-path";

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
 * - network: Network identifier - either a preset name (e.g., "preset1") or an absolute path
 */
networkRoutes.get("/", async (c) => {
  const networkIdentifier = c.req.query("network");
  const networkPath = resolveNetworkPath(networkIdentifier);

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
 * - network: Network identifier - either a preset name (e.g., "preset1") or an absolute path
 * - type: Filter by node type (optional)
 */
networkRoutes.get("/nodes", async (c) => {
  const networkIdentifier = c.req.query("network");
  console.log(
    "[network/nodes] Raw network identifier:",
    JSON.stringify(networkIdentifier)
  );
  const networkPath = resolveNetworkPath(networkIdentifier);
  console.log("[network/nodes] Resolved path:", networkPath);
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
 * - network: Network identifier - either a preset name (e.g., "preset1") or an absolute path
 * - source: Filter by source node ID (optional)
 * - target: Filter by target node ID (optional)
 */
networkRoutes.get("/edges", async (c) => {
  const networkIdentifier = c.req.query("network");
  const networkPath = resolveNetworkPath(networkIdentifier);
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
 * Content type mapping for common image/asset types
 */
const CONTENT_TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
};

/**
 * GET /api/network/assets/*
 * Serve static assets (images, SVGs) from a network directory
 *
 * Query params:
 * - network: Network identifier - either a preset name (e.g., "preset1") or an absolute path
 *
 * The wildcard path after /assets/ is the relative path to the asset within the network directory
 *
 * Example: /api/network/assets/images/map.svg?network=preset1
 *          serves networks/preset1/images/map.svg
 */
networkRoutes.get("/assets/*", async (c) => {
  const networkIdentifier = c.req.query("network");
  const networkPath = resolveNetworkPath(networkIdentifier);

  // Get the asset path from the URL (everything after /assets/)
  const url = new URL(c.req.url);
  const assetRelativePath = url.pathname.replace(/^\/api\/network\/assets\//, "");

  if (!assetRelativePath) {
    return c.json({ error: "Asset path is required" }, 400);
  }

  // Decode URL-encoded path components
  const decodedPath = decodeURIComponent(assetRelativePath);

  // Resolve the full path to the asset
  const assetFullPath = path.resolve(networkPath, decodedPath);

  // Security check: ensure the resolved path is still within the network directory
  // This prevents directory traversal attacks (e.g., ../../etc/passwd)
  const normalizedNetworkPath = path.normalize(networkPath);
  const normalizedAssetPath = path.normalize(assetFullPath);

  if (!normalizedAssetPath.startsWith(normalizedNetworkPath)) {
    return c.json({ error: "Invalid asset path" }, 403);
  }

  try {
    // Check if file exists
    const stats = await fs.stat(assetFullPath);

    if (!stats.isFile()) {
      return c.json({ error: "Asset not found" }, 404);
    }

    // Read the file
    const fileBuffer = await fs.readFile(assetFullPath);

    // Determine content type from extension
    const ext = path.extname(assetFullPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

    // Return the file with appropriate headers
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": stats.size.toString(),
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return c.json({ error: "Asset not found" }, 404);
    }
    return c.json(
      {
        error: "Failed to load asset",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});
