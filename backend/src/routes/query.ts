import { Hono } from "hono";
import { queryNetwork } from "../services/query";

export const queryRoutes = new Hono();

/**
 * GET /api/query
 * Query the network using the query path syntax
 *
 * Query params:
 * - q: The query path (e.g., "branch-4/data/blocks[type=Pipe]")
 * - network: Network name (default: "preset1") - looks in backend/networks/
 * - version: Schema version for metadata lookup (default: "v1.0")
 */
queryRoutes.get("/", async (c) => {
  const query = c.req.query("q");
  const networkName = c.req.query("network") || "preset1";
  const schemaVersion = c.req.query("version");
  const networkPath = `networks/${networkName}`;

  if (!query) {
    return c.json({ error: "Missing required query parameter: q" }, 400);
  }

  try {
    const result = await queryNetwork(networkPath, query, schemaVersion);
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
