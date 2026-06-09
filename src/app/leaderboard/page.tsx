import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { LeaderboardPage } from "src/features/leaderboard/components/LeaderboardPage";
import { LeaderboardSkeleton } from "src/features/leaderboard/components/skeletons";
import { prefetchSmartLeaderboard } from "src/features/leaderboard/data/prefetch";
import {
  leaderboardTagForScope,
  parseInterval,
  parseScope,
  type LeaderboardScope,
} from "src/features/leaderboard/routeParams";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { detectLanguage } from "src/i18n/detectLanguage";
import { mapToApiLang } from "src/i18n/locales";
import type { LeaderboardInterval } from "src/features/leaderboard/types";

const PREFETCH_TIMEOUT_MS = 3000;

/**
 * SSR-prefetches the smart-money leaderboard for the URL-selected interval
 * (bounded by a 3s race so a slow backend never blocks the shell) and hydrates
 * it. The interval matches {@link LeaderboardPage}'s URL-derived value so the
 * client query hits the hydrated cache instead of refetching. While this
 * awaits, the parent Suspense streams the leaderboard skeleton.
 */
async function LeaderboardContent({
  interval,
  scope,
}: {
  interval: LeaderboardInterval;
  scope: LeaderboardScope;
}) {
  const queryClient = createServerQueryClient();
  const lang = mapToApiLang(await detectLanguage());
  const tag = leaderboardTagForScope(scope);

  await Promise.race([
    prefetchSmartLeaderboard(queryClient, interval, lang, tag),
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
 * Smart Money Leaderboard route. The time window (`?interval=`) drives the SSR
 * prefetch. Wallet detail lives at `/leaderboard/[wallet]`.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const interval = parseInterval(params.interval);
  const scope = parseScope(params.scope);
  return (
    <Suspense fallback={<LeaderboardSkeleton />}>
      <LeaderboardContent interval={interval} scope={scope} />
    </Suspense>
  );
}
