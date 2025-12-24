import { Hono } from 'hono';
import { getSchemas, getSchema, validateBlock } from '../services/schema';

export const schemaRoutes = new Hono();

/**
 * GET /api/schema
 * Get all available schema versions
 * 
 * Query params:
 * - schemasDir: Path to schemas directory (default: "../schemas")
 */
schemaRoutes.get('/', async (c) => {
  const schemasDir = c.req.query('schemasDir') || '../schemas';

  try {
    const schemas = await getSchemas(schemasDir);
    return c.json(schemas);
  } catch (error) {
    return c.json(
      { error: 'Failed to load schemas', message: error instanceof Error ? error.message : String(error) },
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
schemaRoutes.get('/:version', async (c) => {
  const version = c.req.param('version');
  const schemasDir = c.req.query('schemasDir') || '../schemas';

  try {
    const schema = await getSchema(schemasDir, version);
    return c.json(schema);
  } catch (error) {
    return c.json(
      { error: 'Failed to load schema', message: error instanceof Error ? error.message : String(error) },
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
schemaRoutes.post('/validate', async (c) => {
  try {
    const body = await c.req.json();
    const { version, blockType, block, schemasDir } = body;

    if (!version || !blockType || !block) {
      return c.json({ error: 'Missing required fields: version, blockType, block' }, 400);
    }

    const result = await validateBlock(schemasDir || '../schemas', version, blockType, block);
    return c.json(result);
  } catch (error) {
    return c.json(
      { error: 'Validation failed', message: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});

