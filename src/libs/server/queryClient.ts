import { QueryClient } from "@tanstack/react-query";

/**
 * Create a fresh QueryClient for server-side prefetching.
 *
 * Must be a new instance per request — never reuse the client-side singleton
 * because that would leak data between requests.
 */
export function createServerQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
      },
    },
  });
}
