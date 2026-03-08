import { Effect, Either } from "effect";
import {
  type Block,
  validateNetworkBlocks,
  type NetworkData as ValidationNetworkData,
  type NetworkSource as ValidationNetworkSource,
} from "../../../services/effectValidation";
import {
  transformNetworkToSnapshotConditions,
  transformScenarioResponse,
  type ScenarioFailResponse,
  type ScenarioOkResponse,
  type ScenarioRequest,
} from "../../../services/snapshot";
import {
  SnapshotRunRequestSchema,
  SnapshotValidateRequestSchema,
  type SnapshotRunRequestInput,
  type SnapshotValidateRequestInput,
  type ValidationError,
  validateRequest,
} from "../../../services/snapshot/schemas";
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
import { resolveNetworkPath } from "../../config";

type ParseResult<A> =
  | { readonly _tag: "Left"; readonly left: ValidationError[] }
  | { readonly _tag: "Right"; readonly right: A };

function toValidationNetworkSource(
  source: SnapshotRunRequestInput["source"] | SnapshotValidateRequestInput["source"],
  config: DaggerServerConfig,
): ValidationNetworkSource {
  if (source.type === "networkId") {
    return {
      type: "networkId",
      networkId: resolveNetworkPath(config, source.networkId),
    };
  }

  const network: ValidationNetworkData = {
    groups: source.network.groups.map((group) => ({
      id: group.id,
      label: group.label,
      branchIds: [...group.branchIds],
    })),
    branches: source.network.branches.map((branch) => ({
      id: branch.id,
      label: branch.label,
      parentId: branch.parentId,
      blocks: branch.blocks.map((block) => {
        const normalized: Block = {
          type: block.type,
        };

        if (typeof block.quantity === "number") {
          normalized.quantity = block.quantity;
        }

        for (const [key, value] of Object.entries(block)) {
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            value === null ||
            value === undefined
          ) {
            normalized[key] = value;
          }
        }

        return normalized;
      }),
    })),
  };

  return {
    type: "data",
    network,
  };
}

export const snapshotOperationModule =
  createOperationModule<DaggerServerConfig>({
    name: "snapshot",
    prefix: "/api/operations/snapshot",
    register: (app, config) =>
      app
        .post("/validate", async ({ body, set }) =>
          runRequest(
            Effect.gen(function* () {
              const parseResult = validateRequest(
                SnapshotValidateRequestSchema,
                body,
              ) as ParseResult<SnapshotValidateRequestInput>;
              if (parseResult._tag === "Left") {
                return yield* Effect.fail(
                  badRequest("Invalid request", {
                    details: parseResult.left,
                  }),
                );
              }

              const payload = {
                ...parseResult.right,
                source: toValidationNetworkSource(
                  parseResult.right.source,
                  config,
                ),
              };

              return yield* tryPromise(
                () =>
                  validateNetworkBlocks(
                    payload.source,
                    "v1.0-snapshot",
                    payload.baseNetworkId,
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
        .post("/run", async ({ body, set }) =>
          runRequest(
            Effect.gen(function* () {
              const parseResult = validateRequest(
                SnapshotRunRequestSchema,
                body,
              ) as ParseResult<SnapshotRunRequestInput>;
              if (parseResult._tag === "Left") {
                return yield* Effect.fail(
                  badRequest("Invalid request", {
                    details: parseResult.left,
                  }),
                );
              }

              const payload = {
                ...parseResult.right,
                source: toValidationNetworkSource(
                  parseResult.right.source,
                  config,
                ),
              };

              const transformResult = yield* tryPromise(
                () =>
                  transformNetworkToSnapshotConditions(
                    payload.source,
                    "v1.0-snapshot",
                    payload.baseNetworkId,
                  ),
                (error) =>
                  internalError("Failed to transform snapshot request", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
              );

              const conditions = { ...transformResult.conditions };
              if (payload.networkConditions?.airMedium !== undefined) {
                conditions["network|Network|airMedium"] = {
                  celsius: payload.networkConditions.airMedium,
                };
              }
              if (payload.networkConditions?.soilMedium !== undefined) {
                conditions["network|Network|soilMedium"] = {
                  celsius: payload.networkConditions.soilMedium,
                };
              }
              if (payload.networkConditions?.waterMedium !== undefined) {
                conditions["network|Network|waterMedium"] = {
                  celsius: payload.networkConditions.waterMedium,
                };
              }

              const scenarioRequest: ScenarioRequest = {
                conditions,
                structure: transformResult.networkStructure,
                series: transformResult.series,
                includeAllPipes: payload.includeAllPipes,
              };

              const scenarioResponse = yield* tryPromise(
                async () => {
                  const response = await fetch(
                    `${config.snapshotServerUrl}/api/Scenario`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(scenarioRequest),
                    },
                  );

                  if (!response.ok) {
                    const errorText = await response.text();
                    throw badGateway("Snapshot server error", {
                      status: response.status,
                      message: errorText,
                    });
                  }

                  return (await response.json()) as
                    | ScenarioOkResponse
                    | ScenarioFailResponse;
                },
                (error) => {
                  if (
                    typeof error === "object" &&
                    error &&
                    "status" in error &&
                    "message" in error
                  ) {
                    return badGateway("Snapshot server error", error);
                  }
                  return serviceUnavailable("Snapshot server unavailable", {
                    message:
                      `Failed to connect to snapshot server at ${config.snapshotServerUrl}. Ensure the Scenario Modeller server is running.`,
                    details:
                      error instanceof Error ? error.message : String(error),
                  });
                },
              );

              return {
                ...transformScenarioResponse(scenarioResponse),
                networkStructure: transformResult.networkStructure,
                series: transformResult.series,
                validation: transformResult.validation,
              };
            }),
            set,
          ),
        )
        .post("/raw", async ({ body, set }) =>
          runRequest(
            Effect.gen(function* () {
              const scenarioRequest = body as ScenarioRequest;
              if (
                !scenarioRequest.conditions ||
                typeof scenarioRequest.conditions !== "object"
              ) {
                return yield* Effect.fail(
                  badRequest("Request must include a 'conditions' object"),
                );
              }

              const scenarioResponse = yield* tryPromise(
                async () => {
                  const response = await fetch(
                    `${config.snapshotServerUrl}/api/Scenario`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(scenarioRequest),
                    },
                  );

                  if (!response.ok) {
                    const errorText = await response.text();
                    throw badGateway("Snapshot server error", {
                      status: response.status,
                      message: errorText,
                    });
                  }

                  return response.json();
                },
                (error) => {
                  if (
                    typeof error === "object" &&
                    error &&
                    "status" in error &&
                    "message" in error
                  ) {
                    return badGateway("Snapshot server error", error);
                  }
                  return serviceUnavailable("Snapshot server unavailable", {
                    message:
                      `Failed to connect to snapshot server at ${config.snapshotServerUrl}. Ensure the Scenario Modeller server is running.`,
                    details:
                      error instanceof Error ? error.message : String(error),
                  });
                },
              );

              return scenarioResponse;
            }),
            set,
          ),
        )
        .get("/health", async ({ set }) =>
          runRequest(
            tryPromise(
              async () => {
                try {
                  const response = await fetch(
                    `${config.snapshotServerUrl}/api/ScenarioDescription`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      signal: AbortSignal.timeout(5000),
                    },
                  );

                  if (response.ok) {
                    return {
                      status: "ok",
                      snapshotServer: config.snapshotServerUrl,
                      serverStatus: "reachable",
                    };
                  }

                  return {
                    status: "degraded",
                    snapshotServer: config.snapshotServerUrl,
                    serverStatus: "unhealthy",
                    statusCode: response.status,
                  };
                } catch (error) {
                  return {
                    status: "error",
                    snapshotServer: config.snapshotServerUrl,
                    serverStatus: "unreachable",
                    message: error instanceof Error ? error.message : String(error),
                  };
                }
              },
              (error) =>
                internalError("Failed to check snapshot health", {
                  message: error instanceof Error ? error.message : String(error),
                }),
            ),
            set,
          ),
        ),
  });
