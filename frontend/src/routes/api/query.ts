import { createFileRoute } from "@tanstack/react-router";
import { proxyToBackend } from "../../lib/api-proxy";
import type { GetApiResponse, App } from "../../lib/api-types";

// Type for the query endpoint response
export type QueryResponse = GetApiResponse<App, "/api/query">;

export const Route = createFileRoute("/api/query" as any)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        // Use raw query string to preserve special characters like colons in units=length:mi
        const queryString = url.search;
        const backendPath = `/api/query${queryString}`;

        try {
          const response = await proxyToBackend(backendPath, {
            method: "GET",
          });

          const data = await response.json();

          if (!response.ok) {
            return Response.json(data, { status: response.status });
          }

          return Response.json(data);
        } catch (error) {
          return Response.json(
            {
              error: "Failed to proxy request to backend",
              message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
