import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { LeaderboardPage } from "src/features/leaderboard/components/LeaderboardPage";
import { LeaderboardSkeleton } from "src/features/leaderboard/components/skeletons";
import { prefetchSmartLeaderboard } from "src/features/leaderboard/data/prefetch";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { detectLanguage } from "src/i18n/detectLanguage";
import { mapToApiLang } from "src/i18n/locales";

const PREFETCH_TIMEOUT_MS = 3000;

/**
 * SSR-prefetches the ALL-time smart-money leaderboard (bounded by a 3s race so
 * a slow backend never blocks the shell) and hydrates it. While this awaits,
 * the parent Suspense streams the leaderboard skeleton.
 */
async function LeaderboardContent() {
  const queryClient = createServerQueryClient();
  const lang = mapToApiLang(await detectLanguage());

  await Promise.race([
    prefetchSmartLeaderboard(queryClient, "all", lang),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("prefetch timeout")), PREFETCH_TIMEOUT_MS),
    ),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LeaderboardPage />
    </HydrationBoundary>
  );
}

/**
 * Smart Money Leaderboard route. The selected wallet lives in the `?wallet=`
 * search param (read client-side in {@link LeaderboardPage}); the board itself
 * is SSR-prefetched and hydrated. Wrapped in Suspense because the page reads
 * search params on the client.
 */
export default function Page() {
  return (
    <Suspense fallback={<LeaderboardSkeleton />}>
      <LeaderboardContent />
    </Suspense>
  );
}
