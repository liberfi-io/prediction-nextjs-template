import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import {
  resolveEventsParams,
  infiniteEventsQueryKey,
  fetchEventsPage,
} from "@liberfi.io/react-predict/server";
import { getServerPredictClient } from "src/libs/server/predictClient";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { PredictListPage } from "src/components/page/PredictListPage";

export default async function Page() {
  const queryClient = createServerQueryClient();
  const client = getServerPredictClient();

  const params = resolveEventsParams({
    source: "dflow",
    sort_by: "volume_24h",
    sort_asc: false,
  });

  await Promise.race([
    queryClient.prefetchInfiniteQuery({
      queryKey: infiniteEventsQueryKey(params),
      queryFn: ({ pageParam }) =>
        fetchEventsPage(client, {
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
