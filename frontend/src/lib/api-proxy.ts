export function getBackendUrl(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof process !== "undefined" && process.env.VITE_API_URL) {
    return process.env.VITE_API_URL;
  }
  if (typeof process !== "undefined") {
    return process.env.BACKEND_URL || "http://backend:3001";
  }
  return "";
}

export function getApiBaseUrl(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof process !== "undefined" && process.env.VITE_API_URL) {
    return process.env.VITE_API_URL;
  }
  const isBrowser = typeof window !== "undefined";
  if (isBrowser) {
    return "http://localhost:3001";
  }
  return process.env.BACKEND_URL || "http://backend:3001";
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
