import { Hono } from 'hono';
import { queryNetwork } from '../services/query';

export const queryRoutes = new Hono();

/**
 * GET /api/query
 * Query the network using the query path syntax
 * 
 * Query params:
 * - q: The query path (e.g., "branch-4/data/blocks[type=Pipe]")
 * - network: Path to the network directory (default: "../network/preset1")
 */
queryRoutes.get('/', async (c) => {
  const query = c.req.query('q');
  const networkPath = c.req.query('network') || '../network/preset1';

  if (!query) {
    return c.json({ error: 'Missing required query parameter: q' }, 400);
  }

  try {
    const result = await queryNetwork(networkPath, query);
    return c.json(result);
  } catch (error) {
    return c.json(
      { error: 'Query failed', message: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});

