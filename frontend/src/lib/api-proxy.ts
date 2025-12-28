/**
 * Helper function to proxy requests to the backend API
 */
export function getBackendUrl(): string {
  // In server-side code (TanStack Start), we can use process.env
  // In browser, we'd use import.meta.env.VITE_API_URL
  if (typeof process !== "undefined" && process.env.VITE_API_URL) {
    return process.env.VITE_API_URL;
  }

  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // When running in Docker (server-side), use the service name
  // When running in browser or locally, use localhost
  if (typeof process !== "undefined") {
    // Server-side: use Docker service name if in container, otherwise localhost
    return process.env.BACKEND_URL || "http://backend:3001";
  }

  // Client-side: always use localhost (browser connects to host, not container)
  return "http://localhost:3001";
}

/**
 * Proxy a request to the backend API
 */
export async function proxyToBackend(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const backendUrl = getBackendUrl();
  const url = `${backendUrl}${path}`;

  // Forward the request to the backend
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  return response;
}
