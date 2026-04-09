import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import {
  matchMarketsQueryKey,
  fetchMatchMarketsPage,
} from "@liberfi.io/react-predict/server";
import { getServerPredictClient } from "src/libs/server/predictClient";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { PredictMatchesPage } from "src/components/page/PredictMatchesPage";

const DEFAULT_PARAMS = {
  sort_by: "spread" as const,
  sort_asc: false,
  min_volume: 5_000,
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
