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
import { useResolvedApiLang } from "../../../i18n/ResolvedLocaleProvider";
import type {
  LeaderboardInterval,
  PositionSortField,
  PositionStatus,
  SortOrder,
} from "../types";
import {
  LEADERBOARD_PAGE_SIZE,
  SMART_LIVE_FEED_LIMIT,
  fetchPortfolioDailyPnl,
  fetchPortfolioPnl,
  fetchPortfolioPositions,
  fetchSmartLeaderboard,
  fetchSmartMoneyLiveFeed,
  fetchWalletActivities,
  fetchWalletDailyPnl,
  fetchWalletPnl,
  fetchWalletPositions,
  leaderboardQueryKey,
  portfolioDailyPnlQueryKey,
  portfolioPnlQueryKey,
  portfolioPositionsQueryKey,
  smartMoneyLiveFeedQueryKey,
  walletActivitiesQueryKey,
  walletDailyPnlQueryKey,
  walletPnlQueryKey,
  walletPositionsQueryKey,
} from "./client";

/** Browser-side API prefix (rewritten by Next.js to `PREDICT_URL`). */
const CLIENT_BASE = process.env.NEXT_PUBLIC_PREDICT_URL ?? "/predict-api";

/** Wallet detail data stays fresh for a minute (guide §8: 30-60s). */
const WALLET_STALE_MS = 60_000;
/** Activities page size. */
const ACTIVITIES_PAGE_SIZE = 30;
/** Positions page size. */
const POSITIONS_PAGE_SIZE = 50;

/** Backend `?lang=` value for the active UI language. */
function useApiLang(): string {
  return useResolvedApiLang();
}

/** Fetch the smart-money leaderboard for a time window (no short polling). */
export function useSmartMoneyBoard(interval: LeaderboardInterval, tag?: string | null) {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...leaderboardQueryKey(interval, tag), lang],
    queryFn: () =>
      fetchSmartLeaderboard(CLIENT_BASE, interval, {
        limit: LEADERBOARD_PAGE_SIZE,
        lang,
        tag,
      }),
    staleTime: WALLET_STALE_MS,
  });
}

/** Fetch the smart-money live feed initial snapshot. Realtime updates arrive via WS. */
export function useSmartMoneyLiveFeed(tag?: string | null) {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...smartMoneyLiveFeedQueryKey(tag), lang],
    queryFn: () =>
      fetchSmartMoneyLiveFeed(CLIENT_BASE, {
        limit: SMART_LIVE_FEED_LIMIT,
        lang,
        tag,
      }),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/** Fetch a selected wallet's full PNL detail. */
export function useWalletPnl(
  wallet: string | undefined,
  interval?: LeaderboardInterval,
  tag?: string | null,
) {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...walletPnlQueryKey(wallet ?? "", interval, tag), lang],
    queryFn: () =>
      fetchWalletPnl(CLIENT_BASE, wallet as string, {
        lang,
        interval,
        tag,
      }),
    enabled: Boolean(wallet),
    staleTime: WALLET_STALE_MS,
  });
}

/** Fetch the connected user's portfolio PNL detail. */
export function usePortfolioPnl(
  user: string | undefined,
  interval?: LeaderboardInterval,
  tag?: string | null,
) {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...portfolioPnlQueryKey(user ?? "", interval, tag), lang],
    queryFn: () =>
      fetchPortfolioPnl(CLIENT_BASE, user as string, {
        lang,
        interval,
        tag,
      }),
    enabled: Boolean(user),
    staleTime: WALLET_STALE_MS,
  });
}

/** Fetch a selected wallet's daily PNL chart series. */
export function useWalletDailyPnl(
  wallet: string | undefined,
  interval?: LeaderboardInterval,
  tag?: string | null,
) {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...walletDailyPnlQueryKey(wallet ?? "", interval, tag), lang],
    queryFn: () =>
      fetchWalletDailyPnl(CLIENT_BASE, wallet as string, {
        lang,
        interval,
        tag,
      }),
    enabled: Boolean(wallet),
    staleTime: WALLET_STALE_MS,
  });
}

/** Fetch the connected user's portfolio daily PNL chart series. */
export function usePortfolioDailyPnl(
  user: string | undefined,
  interval?: LeaderboardInterval,
  tag?: string | null,
) {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...portfolioDailyPnlQueryKey(user ?? "", interval, tag), lang],
    queryFn: () =>
      fetchPortfolioDailyPnl(CLIENT_BASE, user as string, {
        lang,
        interval,
        tag,
      }),
    enabled: Boolean(user),
    staleTime: WALLET_STALE_MS,
  });
}

/**
 * Infinite, cursor-paginated token positions for a wallet (POSITIONS tabs).
 * Server-sorted by `sortBy`/`order` when provided; omitting both leaves the
 * backend's default order (the UI default — "unsorted"). The sort is part of
 * the query key so a sort change starts a fresh paginated query.
 *
 * `placeholderData` is explicitly opted out of the global keep-previous-data
 * default: on a sort change we WANT the query to enter the pending state so the
 * table can show its skeleton (otherwise the stale rows linger and the switch
 * feels unresponsive).
 */
export function useWalletPositions(
  wallet: string | undefined,
  sortBy?: PositionSortField,
  order?: SortOrder,
  interval?: LeaderboardInterval,
  tag?: string | null,
  status?: PositionStatus,
) {
  const lang = useApiLang();
  return useInfiniteQuery({
    queryKey: [
      ...walletPositionsQueryKey(wallet ?? "", sortBy, order, interval, tag, status),
      lang,
    ],
    queryFn: ({ pageParam }) =>
      fetchWalletPositions(CLIENT_BASE, wallet as string, {
        sortBy,
        order,
        status,
        limit: POSITIONS_PAGE_SIZE,
        cursor: pageParam,
        lang,
        interval,
        tag,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor || undefined,
    enabled: Boolean(wallet),
    staleTime: WALLET_STALE_MS,
    placeholderData: undefined,
  });
}

/**
 * Infinite, cursor-paginated token PNL positions for the connected user's
 * portfolio. This is for summary-card exposure, not the tradeable
 * portfolio list below the cards.
 */
export function usePortfolioPositions(
  user: string | undefined,
  sortBy?: PositionSortField,
  order?: SortOrder,
  interval?: LeaderboardInterval,
  tag?: string | null,
  status?: PositionStatus,
) {
  const lang = useApiLang();
  return useInfiniteQuery({
    queryKey: [
      ...portfolioPositionsQueryKey(user ?? "", sortBy, order, interval, tag, status),
      lang,
    ],
    queryFn: ({ pageParam }) =>
      fetchPortfolioPositions(CLIENT_BASE, user as string, {
        sortBy,
        order,
        status,
        limit: POSITIONS_PAGE_SIZE,
        cursor: pageParam,
        lang,
        interval,
        tag,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor || undefined,
    enabled: Boolean(user),
    staleTime: WALLET_STALE_MS,
    placeholderData: undefined,
  });
}

/**
 * Infinite, cursor-paginated trade activities for a wallet (ACTIVITY tab).
 * Each page forwards the opaque cursor returned by the previous page.
 */
export function useWalletActivities(
  wallet: string | undefined,
  interval?: LeaderboardInterval,
  tag?: string | null,
) {
  const lang = useApiLang();
  return useInfiniteQuery({
    queryKey: [...walletActivitiesQueryKey(wallet ?? "", interval, tag), lang],
    queryFn: ({ pageParam }) =>
      fetchWalletActivities(CLIENT_BASE, wallet as string, {
        limit: ACTIVITIES_PAGE_SIZE,
        cursor: pageParam,
        lang,
        interval,
        tag,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor || undefined,
    enabled: Boolean(wallet),
    staleTime: WALLET_STALE_MS,
  });
}
