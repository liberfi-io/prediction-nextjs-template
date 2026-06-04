import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { WorldCupPage } from "src/features/worldcup/components/WorldCupPage";
import { WorldCupTabSkeleton } from "src/features/worldcup/components/skeletons";
import { normalizeTab, type WcTab } from "src/features/worldcup/tabs";
import { createServerQueryClient } from "src/libs/server/queryClient";
import {
  prefetchWorldcupBestThird,
  prefetchWorldcupBracket,
  prefetchWorldcupMatches,
  prefetchWorldcupStandings,
} from "src/features/worldcup/data/queries";

interface PageProps {
  params: Promise<{ tab?: string[] }>;
}

const PREFETCH_TIMEOUT_MS = 3000;

/** Per-tab SSR prefetch: each returns the queries to seed the HydrationBoundary. */
function prefetchForTab(
  tab: WcTab,
  queryClient: QueryClient,
): Promise<unknown> | null {
  switch (tab) {
    case "games":
      return prefetchWorldcupMatches(queryClient);
    case "groups":
      return Promise.all([
        prefetchWorldcupStandings(queryClient),
        prefetchWorldcupBestThird(queryClient),
      ]);
    case "bracket":
      return prefetchWorldcupBracket(queryClient);
    default:
      return null;
  }
}

/**
 * Async tab content: SSR-prefetches the tab's backend endpoints (bounded by a
 * 3s race so a slow backend never blocks the shell) and hydrates them. While
 * this awaits, the parent Suspense streams the tab-specific skeleton.
 */
async function WorldCupTabContent({ tab }: { tab: WcTab }) {
  const queryClient = createServerQueryClient();
  const prefetch = prefetchForTab(tab, queryClient);

  if (prefetch) {
    await Promise.race([
      prefetch,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("prefetch timeout")), PREFETCH_TIMEOUT_MS),
      ),
    ]).catch(() => {});
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WorldCupPage tab={tab} />
    </HydrationBoundary>
  );
}

/**
 * World Cup catch-all route. `/world-cup` is Games; `/world-cup/<tab>` selects
 * props / groups / bracket / map.
 *
 * The data-fetching content is wrapped in Suspense so the first paint shows a
 * tab-specific skeleton, then hydrates; the client then polls every 30s. The
 * Props tab renders from the static dataset (resolves immediately).
 */
export default async function Page({ params }: PageProps) {
  const { tab } = await params;
  const active = normalizeTab(tab?.[0]);

  return (
    <Suspense fallback={<WorldCupTabSkeleton tab={active} />}>
      <WorldCupTabContent tab={active} />
    </Suspense>
  );
}
