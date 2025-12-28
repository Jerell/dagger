import { createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import { QueryClient } from "@tanstack/react-query";

// Create QueryClient with SSR-friendly defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Prevent refetch on mount if data exists (important for SSR hydration)
      refetchOnMount: false,
      // Keep data fresh longer to avoid unnecessary refetches
      staleTime: 1000 * 60 * 5, // 5 minutes
      // Prevent automatic refetches that could cause hydration issues
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {
      queryClient,
    },

    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
