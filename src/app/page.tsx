import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { unstable_cache } from "next/cache";
import {
  resolveEventsParams,
  infiniteEventsQueryKey,
  fetchEventsPage,
  type ListEventsParams,
} from "@liberfi.io/react-predict/server";
import { getServerPredictClient } from "src/libs/server/predictClient";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { PredictListPage } from "src/components/page/PredictListPage";
import { ENABLE_KALSHI } from "src/libs/featureFlags";

const getCachedEventsPage = unstable_cache(
  async (params: ListEventsParams) => {
    const client = getServerPredictClient();
    return fetchEventsPage(client, params);
  },
  ["events-page"],
  { revalidate: 30 },
);

export default async function Page() {
  const queryClient = createServerQueryClient();

  // Mirror the client EventsPage default: when Kalshi is disabled the list is
  // pinned to Polymarket, so the SSR prefetch must use the same `source` to
  // keep the query key aligned and avoid a redundant client refetch.
  const params = resolveEventsParams({
    sort_by: "volume",
    sort_asc: false,
    ...(ENABLE_KALSHI ? {} : { source: "polymarket" as const }),
  });

  await Promise.race([
    queryClient.prefetchInfiniteQuery({
      queryKey: infiniteEventsQueryKey(params),
      queryFn: ({ pageParam }) =>
        getCachedEventsPage({
          ...params,
          ...(pageParam ? { cursor: pageParam } : {}),
        }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage: { has_more?: boolean; next_cursor?: string }) =>
        lastPage.has_more && lastPage.next_cursor
          ? lastPage.next_cursor
          : undefined,
      pages: 1,
    }),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("prefetch timeout")), 3000),
    ),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PredictListPage />
    </HydrationBoundary>
  );
}
