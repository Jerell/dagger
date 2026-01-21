const DEFAULT_BACKEND_URL = "http://localhost:3001";

export function getBackendUrl(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof process !== "undefined" && process.env.VITE_API_URL) {
    return process.env.VITE_API_URL;
  }
  if (typeof process !== "undefined" && process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  return DEFAULT_BACKEND_URL;
}

export function getApiBaseUrl(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof process !== "undefined" && process.env.VITE_API_URL) {
    return process.env.VITE_API_URL;
  }
  if (typeof process !== "undefined" && process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  return DEFAULT_BACKEND_URL;
}

export async function proxyToBackend(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const backendUrl = getBackendUrl();
  const url = `${backendUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  return response;
}
