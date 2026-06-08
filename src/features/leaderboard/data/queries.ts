"use client";

/**
 * Browser React Query hooks for the leaderboard endpoints.
 *
 * Per the SDK guide §8 the leaderboard is NOT short-polled (it updates slowly);
 * wallet PNL / activities use a modest stale time so reopening a wallet is
 * instant while still picking up fresh data on revisit. The active UI language
 * is threaded into both the query key and the request so a language switch
 * refetches localized content.
 *
 * Server-side prefetch lives in `./prefetch` (kept React-free so server
 * components can import it); both share the same query keys so SSR hydration
 * matches.
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "@liberfi.io/i18n";
import { mapToApiLang, toSupportedLang } from "../../../i18n/locales";
import type { LeaderboardInterval } from "../types";
import {
  LEADERBOARD_PAGE_SIZE,
  fetchSmartLeaderboard,
  fetchWalletActivities,
  fetchWalletPnl,
  leaderboardQueryKey,
  walletActivitiesQueryKey,
  walletPnlQueryKey,
} from "./client";

/** Browser-side API prefix (rewritten by Next.js to `PREDICT_URL`). */
const CLIENT_BASE = process.env.NEXT_PUBLIC_PREDICT_URL ?? "/predict-api";

/** Wallet detail data stays fresh for a minute (guide §8: 30-60s). */
const WALLET_STALE_MS = 60_000;
/** Activities page size. */
const ACTIVITIES_PAGE_SIZE = 30;

/** Backend `?lang=` value for the active UI language. */
function useApiLang(): string {
  const { i18n } = useTranslation();
  return mapToApiLang(toSupportedLang(i18n.language));
}

/** Fetch the smart-money leaderboard for a time window (no short polling). */
export function useSmartMoneyBoard(interval: LeaderboardInterval) {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...leaderboardQueryKey(interval), lang],
    queryFn: () =>
      fetchSmartLeaderboard(CLIENT_BASE, interval, {
        limit: LEADERBOARD_PAGE_SIZE,
        lang,
      }),
    staleTime: WALLET_STALE_MS,
  });
}

/** Fetch a selected wallet's full PNL detail. */
export function useWalletPnl(wallet: string | undefined) {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...walletPnlQueryKey(wallet ?? ""), lang],
    queryFn: () => fetchWalletPnl(CLIENT_BASE, wallet as string, { lang }),
    enabled: Boolean(wallet),
    staleTime: WALLET_STALE_MS,
  });
}

/**
 * Infinite, cursor-paginated trade activities for a wallet (ACTIVITY tab).
 * Each page forwards the opaque cursor returned by the previous page.
 */
export function useWalletActivities(wallet: string | undefined) {
  const lang = useApiLang();
  return useInfiniteQuery({
    queryKey: [...walletActivitiesQueryKey(wallet ?? ""), lang],
    queryFn: ({ pageParam }) =>
      fetchWalletActivities(CLIENT_BASE, wallet as string, {
        limit: ACTIVITIES_PAGE_SIZE,
        cursor: pageParam,
        lang,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor || undefined,
    enabled: Boolean(wallet),
    staleTime: WALLET_STALE_MS,
  });
}
