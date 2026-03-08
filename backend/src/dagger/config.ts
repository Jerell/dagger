import path from "node:path";

export type DaggerServerConfig = {
  readonly serviceName: string;
  readonly projectRoot: string;
  readonly port: number;
  readonly availableNetworks: ReadonlyArray<string>;
};

export function createDaggerServerConfig(): DaggerServerConfig {
  return {
    serviceName: "dagger-api",
    projectRoot: process.cwd(),
    port: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000,
    availableNetworks: ["preset1", "simple-snapshot"],
  };
}

export function resolveNetworkPath(
  config: DaggerServerConfig,
  networkIdentifier?: string | null,
): string {
  if (!networkIdentifier) {
    return path.normalize(path.join(config.projectRoot, "networks", "preset1"));
  }

  let trimmed = networkIdentifier.trim().replace(/^["']|["']$/g, "");
  try {
    trimmed = decodeURIComponent(trimmed);
  } catch {
    // Ignore malformed URL encoding and use the raw input.
  }

  if (path.isAbsolute(trimmed)) {
    return path.normalize(trimmed);
  }

  return path.normalize(path.join(config.projectRoot, "networks", trimmed));
}
