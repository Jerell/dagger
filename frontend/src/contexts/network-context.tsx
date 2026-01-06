import { createContext, useContext, type ReactNode } from "react";
import { getApiBaseUrl } from "@/lib/api-proxy";

export type NetworkContextValue = {
  /**
   * The current network identifier (preset name or absolute path)
   */
  networkId: string;
  /**
   * Construct a URL to fetch an asset from the current network
   * @param relativePath - Path relative to the network directory
   */
  getAssetUrl: (relativePath: string) => string;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({
  networkId,
  children,
}: {
  networkId: string;
  children: ReactNode;
}) {
  const getAssetUrl = (relativePath: string) => {
    // Construct the API URL for fetching assets
    const baseUrl = getApiBaseUrl();
    // Don't encode the path - it's used as URL path segments (slashes are valid)
    // Only encode the network query parameter
    const encodedNetwork = encodeURIComponent(networkId);
    return `${baseUrl}/api/network/assets/${relativePath}?network=${encodedNetwork}`;
  };

  return (
    <NetworkContext.Provider value={{ networkId, getAssetUrl }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}

/**
 * Optional hook that returns null if not within a NetworkProvider
 * Useful for components that may be used outside of a network context
 */
export function useNetworkOptional(): NetworkContextValue | null {
  return useContext(NetworkContext);
}
