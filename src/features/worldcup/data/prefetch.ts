/**
 * Server-side worldcup prefetch helpers.
 *
 * Kept separate from `queries.ts` (the browser hooks) on purpose: server
 * components import these to seed the SSR HydrationBoundary, so this module must
 * stay free of React client hooks / the `@liberfi.io/i18n` client barrel
 * (`createContext`). Each helper takes the resolved backend `lang` explicitly
 * and shares the same query keys as the browser hooks so hydration matches
 * (06-i18n.md §M3).
 */

import type { QueryClient } from "@tanstack/react-query";
import {
  WORLDCUP_BEST_THIRD_QUERY_KEY,
  WORLDCUP_BRACKET_QUERY_KEY,
  WORLDCUP_MATCHES_QUERY_KEY,
  WORLDCUP_PROPS_QUERY_KEY,
  WORLDCUP_STANDINGS_QUERY_KEY,
  fetchWorldcupBestThird,
  fetchWorldcupBracket,
  fetchWorldcupCurated,
  fetchWorldcupMatchEvent,
  fetchWorldcupMatches,
  fetchWorldcupProps,
  fetchWorldcupStandings,
  worldcupCuratedQueryKey,
  worldcupMatchEventQueryKey,
  type WcCuratedBucket,
} from "./client";

/**
 * Server-side prefetch into a per-request QueryClient. No-ops when
 * `PREDICT_URL` is unset so SSR degrades to a client-only fetch.
 */
export async function prefetchWorldcupMatches(
  queryClient: QueryClient,
  lang: string,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: [...WORLDCUP_MATCHES_QUERY_KEY, lang],
    queryFn: () => fetchWorldcupMatches(base, lang),
  });
}

/** Server-side prefetch for a single match's full event. */
export async function prefetchWorldcupMatchEvent(
  queryClient: QueryClient,
  slug: string,
  lang: string,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: [...worldcupMatchEventQueryKey(slug), lang],
    queryFn: () => fetchWorldcupMatchEvent(base, slug, lang),
  });
}

/** Server-side prefetch for the standings. */
export async function prefetchWorldcupStandings(
  queryClient: QueryClient,
  lang: string,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: [...WORLDCUP_STANDINGS_QUERY_KEY, lang],
    queryFn: () => fetchWorldcupStandings(base, lang),
  });
}

/** Server-side prefetch for best-third. */
export async function prefetchWorldcupBestThird(
  queryClient: QueryClient,
  lang: string,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: [...WORLDCUP_BEST_THIRD_QUERY_KEY, lang],
    queryFn: () => fetchWorldcupBestThird(base, lang),
  });
}

/** Server-side prefetch for the bracket. */
export async function prefetchWorldcupBracket(
  queryClient: QueryClient,
  lang: string,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: [...WORLDCUP_BRACKET_QUERY_KEY, lang],
    queryFn: () => fetchWorldcupBracket(base, lang),
  });
}

/** Server-side prefetch for props. */
export async function prefetchWorldcupProps(
  queryClient: QueryClient,
  lang: string,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: [...WORLDCUP_PROPS_QUERY_KEY, lang],
    queryFn: () => fetchWorldcupProps(base, lang),
  });
}

/** Server-side prefetch for a curated rail. */
export async function prefetchWorldcupCurated(
  queryClient: QueryClient,
  bucket: WcCuratedBucket,
  lang: string,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: [...worldcupCuratedQueryKey(bucket), lang],
    queryFn: () => fetchWorldcupCurated(base, bucket, lang),
  });
}
