/**
 * Server-side leaderboard prefetch helpers.
 *
 * Kept separate from `queries.ts` (the browser hooks) so server components can
 * seed the SSR HydrationBoundary without pulling in React client hooks or the
 * `@liberfi.io/i18n` client barrel. Each helper takes the resolved backend
 * `lang` explicitly and shares the same query keys as the browser hooks so
 * hydration matches.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { LeaderboardInterval } from "../types";
import {
  LEADERBOARD_PAGE_SIZE,
  fetchSmartLeaderboard,
  fetchWalletDailyPnl,
  fetchWalletPnl,
  leaderboardQueryKey,
  walletDailyPnlQueryKey,
  walletPnlQueryKey,
} from "./client";

/**
 * Server-side prefetch of the smart-money leaderboard. No-ops when
 * `PREDICT_URL` is unset so SSR degrades to a client-only fetch.
 */
export async function prefetchSmartLeaderboard(
  queryClient: QueryClient,
  interval: LeaderboardInterval,
  lang: string,
  tag?: string | null,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: [...leaderboardQueryKey(interval, tag), lang],
    queryFn: () =>
      fetchSmartLeaderboard(base, interval, {
        limit: LEADERBOARD_PAGE_SIZE,
        lang,
        tag,
      }),
  });
}

/** Server-side prefetch of a single wallet's PNL detail. */
export async function prefetchWalletPnl(
  queryClient: QueryClient,
  wallet: string,
  lang: string,
  interval?: LeaderboardInterval,
  tag?: string | null,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base || !wallet) return;
  await queryClient.prefetchQuery({
    queryKey: [...walletPnlQueryKey(wallet, interval, tag), lang],
    queryFn: () => fetchWalletPnl(base, wallet, { lang, interval, tag }),
  });
}

/** Server-side prefetch of a single wallet's daily PNL chart series. */
export async function prefetchWalletDailyPnl(
  queryClient: QueryClient,
  wallet: string,
  lang: string,
  interval?: LeaderboardInterval,
  tag?: string | null,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base || !wallet) return;
  await queryClient.prefetchQuery({
    queryKey: [...walletDailyPnlQueryKey(wallet, interval, tag), lang],
    queryFn: () =>
      fetchWalletDailyPnl(base, wallet, { lang, interval, tag }),
  });
}
