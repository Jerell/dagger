import { createFileRoute } from "@tanstack/react-router";
import { proxyToBackend } from "../../lib/api-proxy";

export const Route = createFileRoute("/api/network")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const queryParams = url.searchParams.toString();
        const backendPath = `/api/network${queryParams ? `?${queryParams}` : ""}`;

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
