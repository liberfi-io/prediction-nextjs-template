import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import {
  resolveEventsParams,
  infiniteEventsQueryKey,
  fetchEventsPage,
} from "@liberfi.io/react-predict/server";
import { getServerPredictClient } from "src/libs/server/predictClient";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { PredictListPage } from "src/components/page/PredictListPage";
import {
  ENABLE_KALSHI,
  MARKET_DATA_FEATURE_CAPABILITY,
} from "src/libs/featureFlags";
import { getPredictionLocaleContext } from "src/i18n/predictionLocaleContext";
import { filterTradableEventsPage } from "src/lib/filterPredictEvents";
import { getEventsMarketDataHydration } from "src/features/market-data/server";

export default async function Page() {
  const queryClient = createServerQueryClient();
  const { lang, requestHeaders } = await getPredictionLocaleContext();
  const client = getServerPredictClient({ headers: requestHeaders });

  // Mirror the client EventsPage default: when Kalshi is disabled the list is
  // pinned to Polymarket, so the SSR prefetch must use the same `source` to
  // keep the query key aligned and avoid a redundant client refetch.
  const params = resolveEventsParams({
    sort_by: "volume",
    sort_asc: false,
    ...(lang ? { lang } : {}),
    ...(ENABLE_KALSHI ? {} : { source: "polymarket" as const }),
  });
  await Promise.race([
    queryClient.prefetchInfiniteQuery({
      queryKey: infiniteEventsQueryKey(params),
      queryFn: ({ pageParam }) =>
        fetchEventsPage(client, {
          ...params,
          ...(pageParam ? { cursor: pageParam } : {}),
        }).then((page) => {
          const filtered = filterTradableEventsPage(page);
          return filtered;
        }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage: {
        has_more?: boolean;
        next_cursor?: string;
      }) =>
        lastPage.has_more && lastPage.next_cursor
          ? lastPage.next_cursor
          : undefined,
      pages: 1,
    }),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("prefetch timeout")), 3000),
    ),
  ]).catch(() => {});
  const marketDataResource = await getEventsMarketDataHydration({
    enabled: MARKET_DATA_FEATURE_CAPABILITY.enabled,
    params,
    requestHeaders,
  }).catch(() => undefined);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PredictListPage
        marketDataCapability={MARKET_DATA_FEATURE_CAPABILITY}
        marketDataResource={marketDataResource}
      />
    </HydrationBoundary>
  );
}
