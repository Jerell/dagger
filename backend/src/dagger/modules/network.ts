import fs from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { Elysia } from "elysia";
import {
  getNetworkEdges,
  getNetworkNodes,
  loadNetwork,
} from "../../services/network";
import { createModule } from "../../core/operations";
import {
  badRequest,
  forbidden,
  internalError,
  notFound,
  runRequest,
  tryPromise,
} from "../../core/http";
import type { DaggerServerConfig } from "../config";
import { resolveNetworkPath } from "../config";

const CONTENT_TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
};

export const networkModule = createModule<DaggerServerConfig>(
  "network",
  (app, config) =>
    app.use(
      new Elysia({ prefix: "/api/network" })
        .get("/", async ({ query, set }) =>
          runRequest(
            tryPromise(
              () => loadNetwork(resolveNetworkPath(config, query.network)),
              (error) =>
                internalError("Failed to load network", {
                  message: error instanceof Error ? error.message : String(error),
                }),
            ),
            set,
          ),
        )
        .get("/nodes", async ({ query, set }) =>
          runRequest(
            tryPromise(
              () =>
                getNetworkNodes(
                  resolveNetworkPath(config, query.network),
                  query.type,
                ),
              (error) =>
                internalError("Failed to load nodes", {
                  message: error instanceof Error ? error.message : String(error),
                }),
            ),
            set,
          ),
        )
        .get("/edges", async ({ query, set }) =>
          runRequest(
            tryPromise(
              () =>
                getNetworkEdges(
                  resolveNetworkPath(config, query.network),
                  query.source,
                  query.target,
                ),
              (error) =>
                internalError("Failed to load edges", {
                  message: error instanceof Error ? error.message : String(error),
                }),
            ),
            set,
          ),
        )
        .get("/list", async ({ set }) =>
          runRequest(
            tryPromise(
              async () =>
                Promise.all(
                  config.availableNetworks.map(async (networkId) => {
                    try {
                      const configPath = path.join(
                        config.projectRoot,
                        "networks",
                        networkId,
                        "config.toml",
                      );
                      const configContent = await fs.readFile(configPath, "utf-8");
                      const labelMatch =
                        configContent.match(/^label\s*=\s*"([^"]+)"/m);
                      return {
                        id: networkId,
                        label: labelMatch ? labelMatch[1] : networkId,
                      };
                    } catch {
                      return { id: networkId, label: networkId };
                    }
                  }),
                ),
              (error) =>
                internalError("Failed to list networks", {
                  message: error instanceof Error ? error.message : String(error),
                }),
            ),
            set,
          ),
        )
        .get("/assets/*", async ({ query, params, set }) =>
          runRequest(
            Effect.gen(function* () {
              const assetRelativePath = decodeURIComponent(params["*"] ?? "");
              if (!assetRelativePath) {
                return yield* Effect.fail(
                  badRequest("Asset path is required"),
                );
              }

              const networkPath = resolveNetworkPath(config, query.network);
              const assetFullPath = path.resolve(networkPath, assetRelativePath);

              if (
                !path
                  .normalize(assetFullPath)
                  .startsWith(path.normalize(networkPath))
              ) {
                return yield* Effect.fail(forbidden("Invalid asset path"));
              }

              const stats = yield* tryPromise(
                () => fs.stat(assetFullPath),
                (error) => {
                  if (
                    typeof error === "object" &&
                    error &&
                    "code" in error &&
                    error.code === "ENOENT"
                  ) {
                    return notFound("Asset not found");
                  }
                  return internalError("Failed to load asset", {
                    message:
                      error instanceof Error ? error.message : String(error),
                  });
                },
              );

              if (!stats.isFile()) {
                return yield* Effect.fail(notFound("Asset not found"));
              }

              const fileBuffer = yield* tryPromise(
                () => fs.readFile(assetFullPath),
                (error) =>
                  internalError("Failed to load asset", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
              );

              const ext = path.extname(assetFullPath).toLowerCase();
              set.headers["content-type"] =
                CONTENT_TYPES[ext] ?? "application/octet-stream";
              set.headers["content-length"] = String(stats.size);
              set.headers["cache-control"] = "public, max-age=3600";
              return fileBuffer;
            }),
            set,
          ),
        ),
    ),
);
