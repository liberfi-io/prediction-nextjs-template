"use client";

/**
 * Browser React Query hooks for the worldcup endpoints. Each hook polls every
 * 30s (aligned with the endpoints' `Cache-Control: max-age=30`) and threads the
 * active UI language into both the query key and the request so a language
 * switch refetches localized content (06-i18n.md §M3).
 *
 * Server-side prefetch lives in `./prefetch` (kept React-free so server
 * components can import it); both share the same query keys so SSR hydration
 * matches.
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "@liberfi.io/i18n";
import { mapToApiLang, toSupportedLang } from "../../../i18n/locales";
import {
  WORLDCUP_BEST_THIRD_QUERY_KEY,
  WORLDCUP_BRACKET_QUERY_KEY,
  WORLDCUP_MATCHES_QUERY_KEY,
  WORLDCUP_PROPS_QUERY_KEY,
  WORLDCUP_STANDINGS_QUERY_KEY,
  fetchWorldcupBestThird,
  fetchWorldcupBracket,
  fetchWorldcupCurated,
  fetchWorldcupFeeds,
  fetchWorldcupMatchEvent,
  fetchWorldcupMatches,
  fetchWorldcupProps,
  fetchWorldcupStandings,
  worldcupCuratedQueryKey,
  worldcupFeedsQueryKey,
  worldcupMatchEventQueryKey,
  type WcCuratedBucket,
} from "./client";

const POLL_INTERVAL_MS = 30_000;

/** Browser-side API prefix (rewritten by Next.js to `PREDICT_URL`). */
const CLIENT_BASE = process.env.NEXT_PUBLIC_PREDICT_URL ?? "/predict-api";

/**
 * The backend `?lang=` value for the active UI language. Read from i18next and
 * collapsed through the same {@link toSupportedLang} policy as the rest of the
 * app, then mapped to the API code. Included in every worldcup query key so a
 * language switch refetches localized content (06-i18n.md §M3).
 */
function useApiLang(): string {
  const { i18n } = useTranslation();
  return mapToApiLang(toSupportedLang(i18n.language));
}

interface WorldcupMatchesOptions {
  enabled?: boolean;
}

/** Poll the worldcup matches list from the browser. */
export function useWorldcupMatches(options: WorldcupMatchesOptions = {}) {
  const lang = useApiLang();
  const enabled = options.enabled ?? true;
  return useQuery({
    queryKey: [...WORLDCUP_MATCHES_QUERY_KEY, lang],
    queryFn: () => fetchWorldcupMatches(CLIENT_BASE, lang),
    enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    staleTime: POLL_INTERVAL_MS,
  });
}

/**
 * Poll a single match's full aggregated event from the browser. Powers the
 * match detail page; every market type is present so the Markets panel can
 * group and switch between them.
 */
export function useWorldcupMatchEvent(slug: string) {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...worldcupMatchEventQueryKey(slug), lang],
    queryFn: () => fetchWorldcupMatchEvent(CLIENT_BASE, slug, lang),
    enabled: Boolean(slug),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

/** Poll the worldcup standings (12 group tables) from the browser. */
export function useWorldcupStandings() {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...WORLDCUP_STANDINGS_QUERY_KEY, lang],
    queryFn: () => fetchWorldcupStandings(CLIENT_BASE, lang),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

/** Poll the worldcup best third-placed teams from the browser. */
export function useWorldcupBestThird() {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...WORLDCUP_BEST_THIRD_QUERY_KEY, lang],
    queryFn: () => fetchWorldcupBestThird(CLIENT_BASE, lang),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

/** Poll the worldcup knockout bracket from the browser. */
export function useWorldcupBracket() {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...WORLDCUP_BRACKET_QUERY_KEY, lang],
    queryFn: () => fetchWorldcupBracket(CLIENT_BASE, lang),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

/** Poll the worldcup prop / futures events from the browser. */
export function useWorldcupProps() {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...WORLDCUP_PROPS_QUERY_KEY, lang],
    queryFn: () => fetchWorldcupProps(CLIENT_BASE, lang),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

/** Poll a curated rail (e.g. bracket related events) from the browser. */
export function useWorldcupCurated(bucket: WcCuratedBucket) {
  const lang = useApiLang();
  return useQuery({
    queryKey: [...worldcupCuratedQueryKey(bucket), lang],
    queryFn: () => fetchWorldcupCurated(CLIENT_BASE, bucket, lang),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

/** Page size for the market-news feed. */
const FEEDS_PAGE_SIZE = 20;

/**
 * Infinite, cursor-paginated market-news feed for a match (event) slug.
 * Powers the "Market News" tab; each page forwards the opaque cursor returned
 * by the previous page.
 */
export function useWorldcupFeeds(slug: string) {
  return useInfiniteQuery({
    queryKey: worldcupFeedsQueryKey(slug),
    queryFn: ({ pageParam }) =>
      fetchWorldcupFeeds(CLIENT_BASE, slug, {
        limit: FEEDS_PAGE_SIZE,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: Boolean(slug),
  });
}
