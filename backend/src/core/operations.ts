import { Elysia } from "elysia";
import type { FlowServerModule } from "./server";

type OperationApp = Elysia<
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

export function createModule<Env>(
  name: string,
  register: FlowServerModule<Env>["register"],
): FlowServerModule<Env> {
  return { name, register };
}

export function createOperationModule<Env>(options: {
  readonly name: string;
  readonly prefix: string;
  readonly register: (app: OperationApp, env: Env) => OperationApp;
}): FlowServerModule<Env> {
  return createModule(options.name, (app, env) =>
    app.use(
      options.register(
        new Elysia({ prefix: options.prefix }) as OperationApp,
        env,
      ) as OperationApp,
    ),
  );
}
