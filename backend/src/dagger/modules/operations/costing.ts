import { Effect, Either } from "effect";
import {
  getModuleLookupService,
  listCostLibraries,
  transformCostingResponse,
  transformNetworkToCostingRequest,
} from "../../../services/costing";
import {
  CostingEstimateRequestSchema,
  formatValidationErrors,
  type CostingEstimateRequestInput,
  type ValidationError,
  validateRequest,
} from "../../../services/costing/schemas";
import type { CostEstimateResponse } from "../../../services/costing/types";
import { createOperationModule } from "../../../core/operations";
import {
  badGateway,
  badRequest,
  internalError,
  runRequest,
  serviceUnavailable,
  tryPromise,
} from "../../../core/http";
import type { DaggerServerConfig } from "../../config";
import { normalizeNetworkSource } from "../../adapters";

type ParseResult<A> =
  | { readonly _tag: "Left"; readonly left: ValidationError[] }
  | { readonly _tag: "Right"; readonly right: A };

function getCostingServerUrl(): string {
  return process.env.COSTING_SERVER_URL ?? "http://localhost:8080";
}

export const costingOperationModule =
  createOperationModule({
    prefix: "/costing",
    register: (app, config: DaggerServerConfig) => {
      const costingServerUrl = getCostingServerUrl();

      return app
        .post("/estimate", async ({ body, set }) =>
          runRequest(
            Effect.gen(function* () {
              const parseResult = validateRequest(
                CostingEstimateRequestSchema,
                body,
              ) as ParseResult<CostingEstimateRequestInput>;
              if (parseResult._tag === "Left") {
                return yield* Effect.fail(
                  badRequest(
                    "Invalid request body",
                    formatValidationErrors(parseResult.left),
                  ),
                );
              }

              const payload = {
                ...parseResult.right,
                source: normalizeNetworkSource(config, parseResult.right.source),
              };
              const currency = payload.targetCurrency || "USD";

              const { request, assetMetadata } = yield* tryPromise(
                () =>
                  transformNetworkToCostingRequest(payload.source, "v1.0-costing", {
                    libraryId: payload.libraryId,
                    assetDefaults: payload.assetDefaults,
                    assetOverrides: payload.assetOverrides,
                  }),
                (error) =>
                  internalError("Failed to transform costing request", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
              );

              if (request.assets.length === 0) {
                return yield* Effect.fail(
                  badRequest("No costable assets found", {
                    assetCount: 0,
                    message:
                      "The network contains no blocks that can be mapped to cost library modules.",
                  }),
                );
              }

              const costingResponse = yield* tryPromise(
                async () => {
                  const response = await fetch(
                    `${costingServerUrl}/api/cost/estimate?library_id=${payload.libraryId}&target_currency_code=${currency}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(request),
                    },
                  );

                  if (!response.ok) {
                    const errorText = await response.text();
                    throw badGateway("Costing server error", {
                      status: response.status,
                      message: errorText,
                    });
                  }

                  return (await response.json()) as CostEstimateResponse;
                },
                (error) => {
                  if (error instanceof Error && error.name === "HttpError") {
                    return error as never;
                  }
                  if (
                    typeof error === "object" &&
                    error &&
                    "status" in error &&
                    "message" in error
                  ) {
                    return badGateway("Costing server error", error);
                  }
                  return serviceUnavailable("Costing server unavailable", {
                    message:
                      `Failed to connect to costing server at ${costingServerUrl}. Ensure the costing server is running.`,
                    details:
                      error instanceof Error ? error.message : String(error),
                  });
                },
              );

              return transformCostingResponse(
                costingResponse,
                assetMetadata,
                currency,
              );
            }),
            set,
          ),
        )
        .post("/validate", async ({ body, set }) =>
          runRequest(
            Effect.gen(function* () {
              const parseResult = validateRequest(
                CostingEstimateRequestSchema,
                body,
              ) as ParseResult<CostingEstimateRequestInput>;
              if (parseResult._tag === "Left") {
                return yield* Effect.fail(
                  badRequest(
                    "Invalid request body",
                    formatValidationErrors(parseResult.left),
                  ),
                );
              }

              const payload = {
                ...parseResult.right,
                source: normalizeNetworkSource(config, parseResult.right.source),
              };

              const { assetMetadata } = yield* tryPromise(
                () =>
                  transformNetworkToCostingRequest(payload.source, "v1.0-costing", {
                    libraryId: payload.libraryId,
                  }),
                (error) =>
                  internalError("Failed to transform costing request", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
              );

              const totalBlocks = assetMetadata.reduce(
                (sum, asset) => sum + asset.blockCount,
                0,
              );
              const costableBlocks = assetMetadata.reduce(
                (sum, asset) => sum + asset.costableBlockCount,
                0,
              );

              return {
                isReady: costableBlocks > 0,
                summary: {
                  assetCount: assetMetadata.length,
                  totalBlocks,
                  costableBlocks,
                  unmappedBlocks: totalBlocks - costableBlocks,
                },
                assets: assetMetadata.map((asset) => ({
                  id: asset.assetId,
                  name: asset.name,
                  isGroup: asset.isGroup,
                  blockCount: asset.blockCount,
                  costableBlockCount: asset.costableBlockCount,
                  usingDefaults: asset.usingDefaults,
                  blocks: asset.blocks.map((block) => ({
                    id: block.id,
                    type: block.type,
                    status: block.status,
                    definedProperties: block.definedProperties,
                    missingProperties: block.missingProperties,
                    moduleType: block.moduleType,
                    moduleSubtype: block.moduleSubtype,
                  })),
                })),
              };
            }),
            set,
          ),
        )
        .get("/libraries", async ({ set }) =>
          runRequest(
            tryPromise(
              async () => ({ libraries: await listCostLibraries() }),
              (error) =>
                internalError("Failed to list libraries", {
                  message: error instanceof Error ? error.message : String(error),
                }),
            ),
            set,
          ),
        )
        .get("/libraries/:id", async ({ params, set }) =>
          runRequest(
            tryPromise(
              async () => {
                const service = await getModuleLookupService(params.id);
                const types = service.listTypes();
                return {
                  id: params.id,
                  types,
                  moduleCount: types.reduce(
                    (sum, type) => sum + service.findByType(type).length,
                    0,
                  ),
                };
              },
              (error) =>
                internalError("Failed to get library", {
                  message: error instanceof Error ? error.message : String(error),
                }),
            ),
            set,
          ),
        )
        .get("/libraries/:id/modules", async ({ params, query, set }) =>
          runRequest(
            tryPromise(
              async () => {
                const service = await getModuleLookupService(params.id);
                if (query.type) {
                  const modules = service.findByType(query.type);
                  return {
                    type: query.type,
                    modules: modules.map((module) => ({
                      id: module.id,
                      subtype: module.subtype,
                      requiredParameters: module.requiredParameters,
                    })),
                  };
                }

                const types = service.listTypes();
                return {
                  types: types.map((type) => ({
                    type,
                    subtypes: service.listSubtypes(type),
                    moduleCount: service.findByType(type).length,
                  })),
                };
              },
              (error) =>
                internalError("Failed to list modules", {
                  message: error instanceof Error ? error.message : String(error),
                }),
            ),
            set,
          ),
        )
        .get("/health", async ({ set }) =>
          runRequest(
            tryPromise(
              async () => {
                try {
                  const response = await fetch(
                    `${costingServerUrl}/api/hello`,
                    {
                      method: "GET",
                      signal: AbortSignal.timeout(5000),
                    },
                  );

                  if (response.ok) {
                    return {
                      status: "ok",
                      costingServer: costingServerUrl,
                      serverStatus: "reachable",
                    };
                  }

                  return {
                    status: "degraded",
                    costingServer: costingServerUrl,
                    serverStatus: "unhealthy",
                    statusCode: response.status,
                  };
                } catch (error) {
                  return {
                    status: "error",
                    costingServer: costingServerUrl,
                    serverStatus: "unreachable",
                    message: error instanceof Error ? error.message : String(error),
                  };
                }
              },
              (error) =>
                internalError("Failed to check costing health", {
                  message: error instanceof Error ? error.message : String(error),
                }),
            ),
            set,
          ),
        );
    },
  });
