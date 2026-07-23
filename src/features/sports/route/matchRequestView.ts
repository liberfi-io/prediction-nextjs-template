import type { SportsPageFilters } from "../types";

export type SportsMatchRequestView = "live" | "upcoming" | "results";

/** Resolves the backend match view, including the default daily Live view. */
export function resolveSportsMatchRequestView(
  filters?: SportsPageFilters,
): SportsMatchRequestView | undefined {
  if (
    filters?.view === "live" ||
    filters?.view === "upcoming" ||
    filters?.view === "results"
  ) {
    return filters.view;
  }
  if (!filters?.view && !filters?.taxonomy_type && !filters?.taxonomy_slug) {
    return "live";
  }
  return undefined;
}
