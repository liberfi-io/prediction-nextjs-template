import { QueryClient, isServer } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        placeholderData: (prev: unknown) => prev,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Return a QueryClient appropriate for the current environment.
 *
 * - **Server**: Always creates a fresh instance so SSR requests never share
 *   cache (avoids stale data leaking between requests and HydrationBoundary
 *   deferring hydration to useEffect — which doesn't run on the server).
 * - **Browser**: Returns a stable singleton so React Query state persists
 *   across navigations.
 */
export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
