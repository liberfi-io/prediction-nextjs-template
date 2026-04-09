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

  const params = resolveEventsParams({
    sort_by: "volume",
    sort_asc: false,
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
