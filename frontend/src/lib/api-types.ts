/**
 * Type helpers for API routes
 * These types are inferred from the backend Hono app
 */

import type { App } from "@backend/index";

/**
 * Extract the response type for a specific route
 *
 * Since InferResponseType has complex constraints, we use a simpler approach:
 * Return the response as a Promise of unknown, which can be manually typed.
 *
 * Usage:
 *   type QueryResponse = GetApiResponse<App, "/api/query">
 *   // Then manually type: const data: QueryResponse = await response.json()
 */
export type ApiResponse<
  _TApp extends { [K in string]: any },
  _TPath extends string,
  _TMethod extends "get" | "post" | "put" | "delete" | "patch" = "get",
> = Promise<unknown>;

/**
 * Helper to get response type for GET requests
 * Usage: type QueryResponse = GetApiResponse<App, "/api/query">
 */
export type GetApiResponse<
  TApp extends { [K in string]: any },
  TPath extends string,
> = ApiResponse<TApp, TPath, "get">;

/**
 * Helper to get response type for POST requests
 * Usage: type ValidateResponse = PostApiResponse<App, "/api/schema/validate">
 */
export type PostApiResponse<
  TApp extends { [K in string]: any },
  TPath extends string,
> = ApiResponse<TApp, TPath, "post">;

/**
 * Re-export the App type for convenience
 */
export type { App };

/**
 * Re-export API client types
 */
export type { NetworkResponse } from "./api-client";
