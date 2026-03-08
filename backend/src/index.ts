import { Effect } from "effect";
import { createOperationsApp } from "./core/operations";
import { createFlowServer } from "./core/server";
import { internalError, tryPromise } from "./core/http";
import { createDaggerServerConfig } from "./dagger/config";
import { queryModule } from "./dagger/modules/query";
import { networkModule } from "./dagger/modules/network";
import { schemaModule } from "./dagger/modules/schema";
import { costingOperationModule } from "./dagger/modules/operations/costing";
import { snapshotOperationModule } from "./dagger/modules/operations/snapshot";
import { initDim } from "./services/dim";

const config = createDaggerServerConfig();
const operationsApp = createOperationsApp()
  .use(costingOperationModule(config))
  .use(snapshotOperationModule(config));

const app = await createFlowServer({
  serviceName: config.serviceName,
  health: { projectRoot: config.projectRoot },
  env: config,
  init: async () => {
    await runInit();
  },
});

const server = app
  .use(queryModule(config))
  .use(networkModule(config))
  .use(schemaModule(config))
  .use(operationsApp);

server.listen(config.port);

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
