import type { SportsPageFilters } from "../types";

export type SportsPageSearchParams = Record<
  string,
  string | string[] | undefined
>;

const FILTER_KEYS = [
  "sport_slug",
  "game_slug",
  "league_slug",
  "tournament_slug",
] as const;

const SPORTS_VIEWS = new Set<SportsPageFilters["view"]>([
  "live",
  "proposals",
]);

export function resolveSportsPageFilters(
  searchParams: SportsPageSearchParams,
): SportsPageFilters {
  const filters: SportsPageFilters = {};
  const view = firstValue(searchParams.view);
  if (SPORTS_VIEWS.has(view as SportsPageFilters["view"])) {
    filters.view = view as SportsPageFilters["view"];
  }
  for (const key of FILTER_KEYS) {
    const value = firstValue(searchParams[key]);
    if (value) filters[key] = value;
  }
  return filters;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0] || undefined;
  return value || undefined;
}
