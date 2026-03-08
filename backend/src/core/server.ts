import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { HttpError } from "./http";

type FlowApp = Elysia<
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

export type FlowServerModule<Env> = {
  readonly name: string;
  register: (
    app: FlowApp,
    env: Env,
  ) => FlowApp;
};

export type CreateFlowServerOptions<Env> = {
  readonly serviceName: string;
  readonly health: Record<string, unknown>;
  readonly env: Env;
  readonly modules: ReadonlyArray<FlowServerModule<Env>>;
  readonly init?: (env: Env) => Promise<void>;
};

export async function createFlowServer<Env>(
  options: CreateFlowServerOptions<Env>,
): Promise<FlowApp> {
  if (options.init) {
    await options.init(options.env);
  }

  let app = new Elysia().use(cors()) as FlowApp;

  app = app.get("/health", () => ({
    status: "ok",
    service: options.serviceName,
    ...options.health,
  }));

  for (const module of options.modules) {
    app = module.register(app, options.env);
  }

  return app.onError(({ code, error, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "not_found", message: "Not found" };
    }

    if (error instanceof HttpError) {
      set.status = error.status;
      return {
        error: error.code,
        message: error.message,
        details: error.details,
      };
    }

    console.error("Unhandled server error:", error);
    set.status = 500;
    return {
      error: "internal_error",
      message: error instanceof Error ? error.message : String(error),
    };
  }) as FlowApp;
}
