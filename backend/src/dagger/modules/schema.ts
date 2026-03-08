import { Effect } from "effect";
import { Elysia } from "elysia";
import {
  getBlockSchemaProperties,
  getNetworkSchemas,
  getSchema,
  getSchemas,
} from "../../services/effectSchemaProperties";
import {
  validateBlockDirect,
  validateNetworkBlocks,
  validateQueryBlocks,
  type Block,
} from "../../services/effectValidation";
import { createModule } from "../../core/operations";
import {
  badRequest,
  internalError,
  runRequest,
  tryPromise,
} from "../../core/http";
import type { DaggerServerConfig } from "../config";
import { extractUnitOverrides, normalizeNetworkSource } from "../adapters";
import { resolveNetworkPath } from "../config";

function isValidationBlock(value: unknown): value is Block {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.type !== "string") {
    return false;
  }

  return Object.entries(candidate).every(([_, entry]) => {
    return (
      typeof entry === "string" ||
      typeof entry === "number" ||
      entry === null ||
      entry === undefined
    );
  });
}

export const schemaModule = createModule<DaggerServerConfig>(
  "schema",
  (app, config) =>
    app.use(
      new Elysia({ prefix: "/api/schema" })
        .get("/", async ({ set }) =>
          runRequest(
            Effect.sync(() => getSchemas()),
            set,
          ),
        )
        .get("/network", async ({ query, set }) =>
          runRequest(
            Effect.gen(function* () {
              if (!query.version) {
                return yield* Effect.fail(
                  badRequest("Missing required query parameter: version"),
                );
              }

              return yield* tryPromise(
                () =>
                  getNetworkSchemas(
                    resolveNetworkPath(config, query.network),
                    query.version!,
                  ),
                (error) =>
                  internalError("Failed to load network schemas", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
              );
            }),
            set,
          ),
        )
        .get("/network/properties", async ({ query, set }) =>
          runRequest(
            Effect.gen(function* () {
              if (!query.version) {
                return yield* Effect.fail(
                  badRequest("Missing required query parameter: version"),
                );
              }

              return yield* tryPromise(
                () =>
                  getNetworkSchemas(
                    resolveNetworkPath(config, query.network),
                    query.version!,
                  ),
                (error) =>
                  internalError("Failed to get network schema properties", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
              );
            }),
            set,
          ),
        )
        .get("/network/validate", async ({ query, request, set }) =>
          runRequest(
            Effect.gen(function* () {
              if (!query.network) {
                return yield* Effect.fail(
                  badRequest("Missing required query parameter: network"),
                );
              }
              if (!query.version) {
                return yield* Effect.fail(
                  badRequest("Missing required query parameter: version"),
                );
              }

              return yield* tryPromise(
                () =>
                  validateNetworkBlocks(
                    normalizeNetworkSource(config, {
                      type: "networkId",
                      networkId: query.network!,
                    }),
                    query.version!,
                    undefined,
                    extractUnitOverrides(request.url),
                  ),
                (error) =>
                  internalError("Failed to validate network blocks", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
              );
            }),
            set,
          ),
        )
        .get("/properties", async ({ query, set }) =>
          runRequest(
            Effect.gen(function* () {
              if (!query.q) {
                return yield* Effect.fail(
                  badRequest("Missing required query parameter: q"),
                );
              }
              if (!query.version) {
                return yield* Effect.fail(
                  badRequest("Missing required query parameter: version"),
                );
              }

              return yield* tryPromise(
                () =>
                  getBlockSchemaProperties(
                    resolveNetworkPath(config, query.network),
                    query.q!,
                    query.version!,
                  ),
                (error) =>
                  internalError("Failed to get block schema properties", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
              );
            }),
            set,
          ),
        )
        .get("/validate", async ({ query, request, set }) =>
          runRequest(
            Effect.gen(function* () {
              if (!query.q) {
                return yield* Effect.fail(
                  badRequest("Missing required query parameter: q"),
                );
              }
              if (!query.version) {
                return yield* Effect.fail(
                  badRequest("Missing required query parameter: version"),
                );
              }

              return yield* tryPromise(
                () =>
                  validateQueryBlocks(
                    resolveNetworkPath(config, query.network),
                    query.q!,
                    query.version!,
                    extractUnitOverrides(request.url),
                  ),
                (error) =>
                  internalError("Validation failed", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
              );
            }),
            set,
          ),
        )
        .post("/validate", async ({ body, set }) =>
          runRequest(
            Effect.gen(function* () {
              const payload = body as Record<string, unknown>;
              const block = payload.block;
              const blockType = payload.blockType;
              const version = payload.version;
              if (
                typeof version !== "string" ||
                typeof blockType !== "string" ||
                !isValidationBlock(block)
              ) {
                return yield* Effect.fail(
                  badRequest(
                    "Missing required fields: version, blockType, block",
                  ),
                );
              }

              return yield* tryPromise(
                () =>
                  validateBlockDirect(
                    block,
                    blockType,
                    version,
                  ),
                (error) =>
                  internalError("Validation failed", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
              );
            }),
            set,
          ),
        )
        .get("/:version", async ({ params, set }) =>
          runRequest(
            Effect.sync(() => getSchema(params.version)),
            set,
          ),
        ),
    ),
);
