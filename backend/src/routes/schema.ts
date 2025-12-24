import { Hono } from "hono";
import {
  getSchemas,
  getSchema,
  validateBlock,
  getNetworkSchemas,
  getBlockSchemaProperties,
} from "../services/schema";

export const schemaRoutes = new Hono();

/**
 * GET /api/schema
 * Get all available schema versions
 *
 * Query params:
 * - schemasDir: Path to schemas directory (default: "../schemas")
 */
schemaRoutes.get("/", async (c) => {
  const schemasDir = c.req.query("schemasDir") || "../schemas";

  try {
    const schemas = await getSchemas(schemasDir);
    return c.json(schemas);
  } catch (error) {
    return c.json(
      {
        error: "Failed to load schemas",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * GET /api/schema/network
 * Get schemas for all block types used in a network
 *
 * Query params:
 * - network: Network name (default: "preset1") - looks in backend/networks/
 * - version: Schema version (required)
 * - schemasDir: Path to schemas directory (default: "../schemas")
 */
schemaRoutes.get("/network", async (c) => {
  const networkName = c.req.query("network") || "preset1";
  const networkPath = `networks/${networkName}`;
  const version = c.req.query("version");
  const schemasDir = c.req.query("schemasDir") || "../schemas";

  if (!version) {
    return c.json({ error: "Missing required query parameter: version" }, 400);
  }

  try {
    const schemas = await getNetworkSchemas(networkPath, schemasDir, version);
    return c.json(schemas);
  } catch (error) {
    return c.json(
      {
        error: "Failed to load network schemas",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * GET /api/schema/properties
 * Get schema properties for blocks matching a query path
 *
 * Query params:
 * - network: Network name (default: "preset1") - looks in backend/networks/
 * - q: Query path (e.g., "branch-4/data/blocks/2" or "branch-4/data/blocks")
 * - version: Schema version (required)
 * - schemasDir: Path to schemas directory (default: "../schemas")
 */
schemaRoutes.get("/properties", async (c) => {
  const networkName = c.req.query("network") || "preset1";
  const networkPath = `networks/${networkName}`;
  const query = c.req.query("q");
  const version = c.req.query("version");
  const schemasDir = c.req.query("schemasDir") || "../schemas";

  if (!query) {
    return c.json({ error: "Missing required query parameter: q" }, 400);
  }

  if (!version) {
    return c.json({ error: "Missing required query parameter: version" }, 400);
  }

  try {
    const properties = await getBlockSchemaProperties(
      networkPath,
      query,
      schemasDir,
      version
    );
    return c.json(properties);
  } catch (error) {
    return c.json(
      {
        error: "Failed to get block schema properties",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * POST /api/schema/validate
 * Validate a block against a schema
 *
 * Body:
 * - version: Schema version
 * - blockType: Type of block to validate
 * - block: Block data to validate
 * - schemasDir: Path to schemas directory (optional)
 */
schemaRoutes.post("/validate", async (c) => {
  try {
    const body = await c.req.json();
    const { version, blockType, block, schemasDir } = body;

    if (!version || !blockType || !block) {
      return c.json(
        { error: "Missing required fields: version, blockType, block" },
        400
      );
    }

    const result = await validateBlock(
      schemasDir || "../schemas",
      version,
      blockType,
      block
    );
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error: "Validation failed",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * GET /api/schema/:version
 * Get schemas for a specific version
 *
 * Query params:
 * - schemasDir: Path to schemas directory (default: "../schemas")
 */
schemaRoutes.get("/:version", async (c) => {
  const version = c.req.param("version");
  const schemasDir = c.req.query("schemasDir") || "../schemas";

  try {
    const schema = await getSchema(schemasDir, version);
    return c.json(schema);
  } catch (error) {
    return c.json(
      {
        error: "Failed to load schema",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});
