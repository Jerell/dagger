import { Hono } from "hono";
import {
  validateQueryBlocks,
  validateNetworkBlocks,
  validateBlockDirect,
} from "../services/effectValidation";
import {
  getSchemas,
  getSchema,
  getNetworkSchemas,
  getBlockSchemaProperties,
} from "../services/effectSchemaProperties";
import { resolveNetworkPath } from "../utils/network-path";

export const schemaRoutes = new Hono();

/**
 * GET /api/schema
 * Get all available schema sets
 */
schemaRoutes.get("/", async (c) => {
  try {
    const schemas = getSchemas();
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
 * Get schema properties for all blocks in a network
 * Returns the same flattened format as /api/schema/properties but for all blocks
 *
 * Query params:
 * - network: Network identifier - either a preset name (e.g., "preset1") or an absolute path
 * - version: Schema set (required, e.g., "v1.0" or "v1.0-costing")
 */
schemaRoutes.get("/network", async (c) => {
  const networkIdentifier = c.req.query("network");
  const networkPath = resolveNetworkPath(networkIdentifier);
  const version = c.req.query("version");

  if (!version) {
    return c.json({ error: "Missing required query parameter: version" }, 400);
  }

  try {
    const schemas = await getNetworkSchemas(networkPath, version);
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
 * GET /api/schema/network/properties
 * Get schema properties for all blocks in a network
 * Returns the same flattened format as /api/schema/properties but for all blocks
 *
 * Query params:
 * - network: Network identifier - either a preset name (e.g., "preset1") or an absolute path
 * - version: Schema set (required, e.g., "v1.0" or "v1.0-costing")
 */
schemaRoutes.get("/network/properties", async (c) => {
  const networkIdentifier = c.req.query("network");
  const networkPath = resolveNetworkPath(networkIdentifier);
  const version = c.req.query("version");

  if (!version) {
    return c.json({ error: "Missing required query parameter: version" }, 400);
  }

  try {
    const properties = await getNetworkSchemas(networkPath, version);
    return c.json(properties);
  } catch (error) {
    return c.json(
      {
        error: "Failed to get network schema properties",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * GET /api/schema/network/validate
 * Validate all blocks in a network and return both properties and validation results
 * Returns the same flattened format as /api/schema/network but includes validation for each block
 *
 * Query params:
 * - network: Network identifier - either a preset name (e.g., "preset1") or an absolute path
 * - version: Schema set (required, e.g., "v1.0" or "v1.0-costing")
 */
schemaRoutes.get("/network/validate", async (c) => {
  const networkIdentifier = c.req.query("network");
  const networkPath = resolveNetworkPath(networkIdentifier);
  const version = c.req.query("version");

  if (!version) {
    return c.json({ error: "Missing required query parameter: version" }, 400);
  }

  // Extract unit preferences from query string
  // Use raw query string to handle colons and special characters correctly
  const queryString = c.req.url.split("?")[1] || "";
  const { parseUnitOverrides } = await import("../services/query");
  const queryOverrides = queryString
    ? parseUnitOverrides(`?${queryString}`)
    : {};

  try {
    const result = await validateNetworkBlocks(
      networkPath,
      version,
      queryOverrides
    );
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error: "Failed to validate network blocks",
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
 * - network: Network identifier - either a preset name (e.g., "preset1") or an absolute path
 * - q: Query path (e.g., "branch-4/blocks/2" or "branch-4/blocks")
 * - version: Schema set (required, e.g., "v1.0" or "v1.0-costing")
 */
schemaRoutes.get("/properties", async (c) => {
  const networkIdentifier = c.req.query("network");
  const networkPath = resolveNetworkPath(networkIdentifier);
  const query = c.req.query("q");
  const version = c.req.query("version");

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
 * GET /api/schema/validate
 * Validate blocks matching a query path and return both properties and validation results
 *
 * Query params:
 * - network: Network identifier - either a preset name (e.g., "preset1") or an absolute path
 * - q: Query path (e.g., "branch-4/blocks/2" or "branch-4/blocks")
 * - version: Schema set (required, e.g., "v1.0" or "v1.0-costing")
 */
schemaRoutes.get("/validate", async (c) => {
  const networkIdentifier = c.req.query("network");
  const networkPath = resolveNetworkPath(networkIdentifier);
  const query = c.req.query("q");
  const version = c.req.query("version");

  if (!query) {
    return c.json({ error: "Missing required query parameter: q" }, 400);
  }

  if (!version) {
    return c.json({ error: "Missing required query parameter: version" }, 400);
  }

  // Extract unit preferences from query string
  // Use raw query string to handle colons and special characters correctly
  const queryString = c.req.url.split("?")[1] || "";
  const { parseUnitOverrides } = await import("../services/query");
  const queryOverrides = queryString
    ? parseUnitOverrides(`?${queryString}`)
    : {};

  try {
    const result = await validateQueryBlocks(
      networkPath,
      query,
      version,
      queryOverrides
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
 * POST /api/schema/validate
 * Validate a block against a schema
 *
 * Body:
 * - version: Schema set (e.g., "v1.0" or "v1.0-costing")
 * - blockType: Type of block to validate
 * - block: Block data to validate
 */
schemaRoutes.post("/validate", async (c) => {
  try {
    const body = await c.req.json();
    const { version, blockType, block } = body;

    if (!version || !blockType || !block) {
      return c.json(
        { error: "Missing required fields: version, blockType, block" },
        400
      );
    }

    // For POST validation, we validate a single block without network context
    // This is a simplified validation that doesn't include scope resolution
    const result = await validateBlockDirect(block, blockType, version);
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
 * Get schemas for a specific schema set
 */
schemaRoutes.get("/:version", async (c) => {
  const version = c.req.param("version");

  try {
    const schema = getSchema(version);
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
