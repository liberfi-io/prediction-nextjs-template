import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { WorldCupPage } from "src/features/worldcup/components/WorldCupPage";
import { normalizeTab } from "src/features/worldcup/tabs";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { prefetchWorldcupMatches } from "src/features/worldcup/data/queries";

interface PageProps {
  params: Promise<{ tab?: string[] }>;
}

/**
 * World Cup catch-all route. `/world-cup` is Games; `/world-cup/<tab>` selects
 * props / groups / bracket / map.
 *
 * The Games tab SSR-prefetches `/worldcup/matches` (bounded by a 3s race so a
 * slow backend never blocks the shell) and hydrates it; the client then polls.
 * Other tabs still render from the bundled static dataset.
 */
export default async function Page({ params }: PageProps) {
  const { tab } = await params;
  const active = normalizeTab(tab?.[0]);

  if (active !== "games") {
    return <WorldCupPage tab={active} />;
  }

  const queryClient = createServerQueryClient();

  await Promise.race([
    prefetchWorldcupMatches(queryClient),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("prefetch timeout")), 3000),
    ),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WorldCupPage tab={active} />
    </HydrationBoundary>
  );
}
