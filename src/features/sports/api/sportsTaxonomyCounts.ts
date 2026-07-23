import type { SportsTaxonomyMatchCount } from "../types";
import type { SportsLiveTimeRange } from "../live/sportsLiveTimeRange";

export const SPORTS_TAXONOMY_COUNTS_PATH =
  "/api/v1/sports/matches/taxonomy-counts";

/** Appends the canonical live time range to a taxonomy-counts URL. */
export function appendSportsLiveTimeRange(
  url: URL,
  timeRange: SportsLiveTimeRange,
): void {
  url.searchParams.set("start_time_gte", timeRange.start_time_gte);
  url.searchParams.set("start_time_lt", timeRange.start_time_lt);
}

/** Normalizes a taxonomy-counts API response. */
export function normalizeSportsTaxonomyCounts(
  value: unknown,
): SportsTaxonomyMatchCount[] {
  return (
    value as {
      items?: SportsTaxonomyMatchCount[];
    }
  ).items ?? [];
}
