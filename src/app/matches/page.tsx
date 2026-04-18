import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import {
  matchMarketsQueryKey,
  fetchMatchMarketsPage,
} from "@liberfi.io/react-predict/server";
import { getServerPredictClient } from "src/libs/server/predictClient";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { PredictMatchesPage } from "src/components/page/PredictMatchesPage";

// v1.1: removed the hardcoded `min_volume: 5000` filter. The matcher's
// `dead_market` pre-filter (both legs < $100 24h volume) already drops
// the truly dead pairs, and the new `signal_tag` (liquid_gap /
// active_gap / stale_gap / stale_data) lets the UI tell users *why* a
// pair is low-quality instead of silently hiding it. Users can still
// raise the floor via the in-page MatchesFilterBar.
const DEFAULT_PARAMS = {
  sort_by: "spread" as const,
  sort_asc: false,
  status: "active" as const,
  limit: 20,
};

export default async function Page() {
  const queryClient = createServerQueryClient();
  const client = getServerPredictClient();

  await Promise.race([
    queryClient.prefetchInfiniteQuery({
      queryKey: matchMarketsQueryKey(DEFAULT_PARAMS),
      queryFn: ({ pageParam }) =>
        fetchMatchMarketsPage(client, {
          ...DEFAULT_PARAMS,
          offset: pageParam,
        }),
      initialPageParam: 0,
      getNextPageParam: (lastPage: {
        total: number;
        offset: number;
        items: unknown[];
      }) => {
        const nextOffset = lastPage.offset + lastPage.items.length;
        return nextOffset < lastPage.total ? nextOffset : undefined;
      },
      pages: 1,
    }),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("prefetch timeout")), 3000),
    ),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PredictMatchesPage />
    </HydrationBoundary>
  );
}
