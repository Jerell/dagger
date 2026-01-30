import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { queryRoutes } from "./routes/query";
import { networkRoutes } from "./routes/network";
import { schemaRoutes } from "./routes/schema";
import { costingRoutes } from "./routes/costing";
import { snapshotRoutes } from "./routes/snapshot";
import dim from "./services/dim";

const app = new Hono();

// Initialize dim at startup
dim.init().catch((err) => {
  console.error("Failed to initialize dim:", err);
  process.exit(1);
});

// CORS middleware
app.use("/*", cors());

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", service: "dagger-api" });
});

// API routes
app.route("/api/query", queryRoutes);
app.route("/api/network", networkRoutes);
app.route("/api/schema", schemaRoutes);
app.route("/api/operations/costing", costingRoutes);
app.route("/api/operations/snapshot", snapshotRoutes);

// Export app type for type inference in frontend
export type App = typeof app;

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Error:", err);
  return c.json({ error: "Internal server error", message: err.message }, 500);
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`🚀 Dagger API server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
