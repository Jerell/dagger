import type { FlowServerModule } from "../../core/server";
import type { DaggerServerConfig } from "../config";
import { networkModule } from "./network";
import { queryModule } from "./query";
import { schemaModule } from "./schema";
import { costingOperationModule } from "./operations/costing";
import { snapshotOperationModule } from "./operations/snapshot";

export const daggerModules: ReadonlyArray<FlowServerModule<DaggerServerConfig>> =
  [
    queryModule,
    networkModule,
    schemaModule,
    costingOperationModule,
    snapshotOperationModule,
  ];
