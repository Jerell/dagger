import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { queryRoutes } from './routes/query.js';
import { networkRoutes } from './routes/network.js';
import { schemaRoutes } from './routes/schema.js';

const app = new Hono();

// CORS middleware
app.use('/*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'dagger-api' });
});

// API routes
app.route('/api/query', queryRoutes);
app.route('/api/network', networkRoutes);
app.route('/api/schema', schemaRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error', message: err.message }, 500);
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`🚀 Dagger API server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

