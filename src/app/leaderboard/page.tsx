import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { LeaderboardPage } from "src/features/leaderboard/components/LeaderboardPage";
import { LeaderboardSkeleton } from "src/features/leaderboard/components/skeletons";
import { LEADERBOARD_TAG } from "src/features/leaderboard/data/client";
import { prefetchSmartLeaderboard } from "src/features/leaderboard/data/prefetch";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { detectLanguage } from "src/i18n/detectLanguage";
import { mapToApiLang } from "src/i18n/locales";
import type { LeaderboardInterval } from "src/features/leaderboard/types";

const PREFETCH_TIMEOUT_MS = 3000;

const INTERVALS = new Set<LeaderboardInterval>(["1d", "7d", "30d", "all"]);
/** Must match {@link LeaderboardPage}'s `DEFAULT_INTERVAL`. */
const DEFAULT_INTERVAL: LeaderboardInterval = "7d";
/** Must match {@link LeaderboardPage}'s `DEFAULT_SCOPE`. */
const DEFAULT_SCOPE: LeaderboardScope = "worldcup";

type LeaderboardScope = "all" | "worldcup";

/**
 * Resolve the board interval from the URL search param, mirroring the client
 * parser so SSR prefetch and the first client query agree on the cache key.
 */
function parseInterval(value: string | string[] | undefined): LeaderboardInterval {
  const v = Array.isArray(value) ? value[0] : value;
  return v && INTERVALS.has(v as LeaderboardInterval)
    ? (v as LeaderboardInterval)
    : DEFAULT_INTERVAL;
}

function parseScope(value: string | string[] | undefined): LeaderboardScope {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "all" ? "all" : DEFAULT_SCOPE;
}

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
  const tag = scope === "worldcup" ? LEADERBOARD_TAG : null;

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
 * Smart Money Leaderboard route. The time window (`?interval=`) and selected
 * wallet (`?wallet=`) live in the URL: the interval drives the SSR prefetch
 * (read here) while the wallet is read client-side in {@link LeaderboardPage}.
 * Wrapped in Suspense because the page reads search params.
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
