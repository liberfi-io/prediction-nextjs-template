import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import {
  matchesQueryKey,
  fetchMatchesPage,
} from "@liberfi.io/react-predict/server";
import { getServerPredictClient } from "src/libs/server/predictClient";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { PredictMatchesPage } from "src/components/page/PredictMatchesPage";

const DEFAULT_PARAMS = { sort_by: "spread" as const, limit: 20 };

export default async function Page() {
  const queryClient = createServerQueryClient();
  const client = getServerPredictClient();

  await Promise.race([
    queryClient.prefetchInfiniteQuery({
      queryKey: matchesQueryKey(DEFAULT_PARAMS),
      queryFn: ({ pageParam }) =>
        fetchMatchesPage(client, {
          ...DEFAULT_PARAMS,
          ...(pageParam ? { cursor: pageParam } : {}),
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

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PredictMatchesPage />
    </HydrationBoundary>
  );
}
