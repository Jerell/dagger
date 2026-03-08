import { parseUnitOverrides } from "../services/query";
import type {
  NetworkSource as CostingNetworkSource,
} from "../services/costing/request-types";
import type { NetworkSource as ValidationNetworkSource } from "../services/effectValidation";
import type { DaggerServerConfig } from "./config";
import { resolveNetworkPath } from "./config";

export function extractUnitOverrides(url: string): Record<string, string> {
  const queryString = url.split("?")[1];
  return queryString ? parseUnitOverrides(`?${queryString}`) : {};
}

export function normalizeNetworkSource<
  T extends CostingNetworkSource | ValidationNetworkSource,
>(config: DaggerServerConfig, source: T): T {
  if (source.type !== "networkId") {
    return source;
  }

  return {
    ...source,
    networkId: resolveNetworkPath(config, source.networkId),
  } as T;
}
