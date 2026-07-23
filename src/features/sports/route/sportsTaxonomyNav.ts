import type {
  SportsPageFilters,
  SportsSection,
  SportsTaxonomyNode,
} from "../types";
import { taxonomyParams } from "../types";
import type { SportsLiveTimeRange } from "../live/sportsLiveTimeRange";

/** Builds a canonical taxonomy URL, optionally preserving a special view. */
export function taxonomyHref(
  section: SportsSection,
  node: SportsTaxonomyNode,
  view?: SportsPageFilters["view"],
  timeRange?: SportsLiveTimeRange,
  liveRangeStart?: string,
): string {
  const params = new URLSearchParams();
  if (view) params.set("view", view);
  if (view === "live" && timeRange) {
    params.set("start_time_gte", timeRange.start_time_gte);
    params.set("start_time_lt", timeRange.start_time_lt);
  }
  if (view === "live" && liveRangeStart) {
    params.set("live_range_start", liveRangeStart);
  }
  const nextFilters = taxonomyNodeFilter(node);
  for (const [key, value] of Object.entries(nextFilters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `/${section}${query ? `?${query}` : ""}`;
}

/** Builds the unfiltered live-view URL for a selected time range. */
export function sportsLiveHref(
  section: SportsSection,
  timeRange: SportsLiveTimeRange,
  liveRangeStart: string,
): string {
  const params = new URLSearchParams({
    view: "live",
    start_time_gte: timeRange.start_time_gte,
    start_time_lt: timeRange.start_time_lt,
    live_range_start: liveRangeStart,
  });
  return `/${section}?${params.toString()}`;
}

export function taxonomyNodeFilter(
  node: SportsTaxonomyNode,
): SportsPageFilters {
  return taxonomyParams(node);
}

export function isTaxonomyNodeActive(
  filters: SportsPageFilters,
  node: SportsTaxonomyNode,
): boolean {
  return (
    filters.taxonomy_type === node.node_type &&
    filters.taxonomy_slug === node.slug
  );
}
