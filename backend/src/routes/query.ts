import { Hono } from "hono";
import { queryNetwork } from "../services/query";
import { resolveNetworkPath } from "../utils/network-path";

export const queryRoutes = new Hono();

/**
 * GET /api/query
 * Query the network using the query path syntax
 *
 * Query params:
 * - q: The query path (e.g., "branch-4/data/blocks[type=Pipe]")
 * - network: Network identifier - either a preset name (e.g., "preset1") or an absolute path
 * - version: Schema version for metadata lookup (default: "v1.0")
 */
queryRoutes.get("/", async (c) => {
  const query = c.req.query("q");
  const networkIdentifier = c.req.query("network");
  const schemaVersion = c.req.query("version");
  const networkPath = resolveNetworkPath(networkIdentifier);

  if (!query) {
    return c.json({ error: "Missing required query parameter: q" }, 400);
  }

  // Extract unit preferences from HTTP query string
  const queryString = c.req.url.split("?")[1] || "";
  const { parseUnitOverrides } = await import("../services/query");
  const queryOverrides = queryString
    ? parseUnitOverrides(`?${queryString}`)
    : {};

  try {
    const result = await queryNetwork(
      networkPath,
      query,
      schemaVersion,
      queryOverrides
    );
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error: "Query failed",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});
