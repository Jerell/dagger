import { Effect } from "effect";
import { Elysia } from "elysia";
import { queryNetwork } from "../../services/query";
import { createModule } from "../../core/operations";
import {
  badRequest,
  internalError,
  runRequest,
  tryPromise,
} from "../../core/http";
import type { DaggerServerConfig } from "../config";
import { extractUnitOverrides } from "../adapters";
import { resolveNetworkPath } from "../config";

export const queryModule = createModule(
  (config: DaggerServerConfig) =>
    new Elysia({ prefix: "/api/query" }).get(
      "/",
      async ({ query, request, set }) =>
        runRequest(
          Effect.gen(function* () {
            const q = query.q;
            if (!q) {
              return yield* Effect.fail(
                badRequest("Missing required query parameter: q"),
              );
            }

            return yield* tryPromise(
              () =>
                queryNetwork(
                  resolveNetworkPath(config, query.network),
                  q,
                  query.version,
                  extractUnitOverrides(request.url),
                ),
              (error) =>
                internalError("Query failed", {
                  message: error instanceof Error ? error.message : String(error),
                }),
            );
          }),
          set,
        ),
    ),
);
