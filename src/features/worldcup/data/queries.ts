/**
 * React Query bindings for the worldcup matches list.
 *
 * - {@link useWorldcupMatches} runs in the browser and polls every 30s
 *   (aligned with the endpoint's `Cache-Control: max-age=30`).
 * - {@link prefetchWorldcupMatches} runs on the server to seed the SSR
 *   HydrationBoundary so the first paint is fully rendered.
 *
 * Both share {@link WORLDCUP_MATCHES_QUERY_KEY}; only the API base differs
 * (server hits `PREDICT_URL` directly, the browser hits the `/predict-api`
 * rewrite prefix).
 */

import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  WORLDCUP_BEST_THIRD_QUERY_KEY,
  WORLDCUP_BRACKET_QUERY_KEY,
  WORLDCUP_MATCHES_QUERY_KEY,
  WORLDCUP_PROPS_QUERY_KEY,
  WORLDCUP_STANDINGS_QUERY_KEY,
  fetchWorldcupBestThird,
  fetchWorldcupBracket,
  fetchWorldcupCurated,
  fetchWorldcupMatches,
  fetchWorldcupProps,
  fetchWorldcupStandings,
  worldcupCuratedQueryKey,
  type WcCuratedBucket,
} from "./client";

const POLL_INTERVAL_MS = 30_000;

/** Browser-side API prefix (rewritten by Next.js to `PREDICT_URL`). */
const CLIENT_BASE = process.env.NEXT_PUBLIC_PREDICT_URL ?? "/predict-api";

/** Poll the worldcup matches list from the browser. */
export function useWorldcupMatches() {
  return useQuery({
    queryKey: WORLDCUP_MATCHES_QUERY_KEY,
    queryFn: () => fetchWorldcupMatches(CLIENT_BASE),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

/**
 * Server-side prefetch into a per-request QueryClient. No-ops when
 * `PREDICT_URL` is unset so SSR degrades to a client-only fetch.
 */
export async function prefetchWorldcupMatches(
  queryClient: QueryClient,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: WORLDCUP_MATCHES_QUERY_KEY,
    queryFn: () => fetchWorldcupMatches(base),
  });
}

/** Poll the worldcup standings (12 group tables) from the browser. */
export function useWorldcupStandings() {
  return useQuery({
    queryKey: WORLDCUP_STANDINGS_QUERY_KEY,
    queryFn: () => fetchWorldcupStandings(CLIENT_BASE),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

/** Poll the worldcup best third-placed teams from the browser. */
export function useWorldcupBestThird() {
  return useQuery({
    queryKey: WORLDCUP_BEST_THIRD_QUERY_KEY,
    queryFn: () => fetchWorldcupBestThird(CLIENT_BASE),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

/** Poll the worldcup knockout bracket from the browser. */
export function useWorldcupBracket() {
  return useQuery({
    queryKey: WORLDCUP_BRACKET_QUERY_KEY,
    queryFn: () => fetchWorldcupBracket(CLIENT_BASE),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

/** Server-side prefetch for the standings; no-ops when `PREDICT_URL` is unset. */
export async function prefetchWorldcupStandings(
  queryClient: QueryClient,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: WORLDCUP_STANDINGS_QUERY_KEY,
    queryFn: () => fetchWorldcupStandings(base),
  });
}

/** Server-side prefetch for best-third; no-ops when `PREDICT_URL` is unset. */
export async function prefetchWorldcupBestThird(
  queryClient: QueryClient,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: WORLDCUP_BEST_THIRD_QUERY_KEY,
    queryFn: () => fetchWorldcupBestThird(base),
  });
}

/** Server-side prefetch for the bracket; no-ops when `PREDICT_URL` is unset. */
export async function prefetchWorldcupBracket(
  queryClient: QueryClient,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: WORLDCUP_BRACKET_QUERY_KEY,
    queryFn: () => fetchWorldcupBracket(base),
  });
}

/** Poll the worldcup prop / futures events from the browser. */
export function useWorldcupProps() {
  return useQuery({
    queryKey: WORLDCUP_PROPS_QUERY_KEY,
    queryFn: () => fetchWorldcupProps(CLIENT_BASE),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

/** Server-side prefetch for props; no-ops when `PREDICT_URL` is unset. */
export async function prefetchWorldcupProps(
  queryClient: QueryClient,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: WORLDCUP_PROPS_QUERY_KEY,
    queryFn: () => fetchWorldcupProps(base),
  });
}

/** Poll a curated rail (e.g. bracket related events) from the browser. */
export function useWorldcupCurated(bucket: WcCuratedBucket) {
  return useQuery({
    queryKey: worldcupCuratedQueryKey(bucket),
    queryFn: () => fetchWorldcupCurated(CLIENT_BASE, bucket),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

/** Server-side prefetch for a curated rail; no-ops when `PREDICT_URL` is unset. */
export async function prefetchWorldcupCurated(
  queryClient: QueryClient,
  bucket: WcCuratedBucket,
): Promise<void> {
  const base = process.env.PREDICT_URL;
  if (!base) return;
  await queryClient.prefetchQuery({
    queryKey: worldcupCuratedQueryKey(bucket),
    queryFn: () => fetchWorldcupCurated(base, bucket),
  });
}
