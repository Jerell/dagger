import { Effect } from "effect";
import { createFlowServer } from "./core/server";
import { internalError, tryPromise } from "./core/http";
import { createDaggerServerConfig } from "./dagger/config";
import { daggerModules } from "./dagger/modules";
import { initDim } from "./services/dim";

const config = createDaggerServerConfig();

const app = await createFlowServer({
  serviceName: config.serviceName,
  health: { projectRoot: config.projectRoot },
  env: config,
  modules: daggerModules,
  init: async () => {
    await runInit();
  },
});

app.listen(config.port);

console.log(
  `Elysia server running for ${config.serviceName} at http://localhost:${config.port}`,
);

async function runInit(): Promise<void> {
  const init = tryPromise(
    () => initDim(),
    (error) =>
      internalError("Failed to initialize dim", {
        message: error instanceof Error ? error.message : String(error),
      }),
  );

  return Effect.runPromise(init);
}
