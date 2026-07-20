import type { SportsPageFilters, TaxonomyType } from "../types";

export type SportsPageSearchParams = Record<
  string,
  string | string[] | undefined
>;

const TAXONOMY_TYPES = new Set<SportsPageFilters["taxonomy_type"]>([
  "sport",
  "game",
  "league",
  "tournament",
]);

const SPORTS_VIEWS = new Set<SportsPageFilters["view"]>(["live", "proposals"]);

export function resolveSportsPageFilters(
  searchParams: SportsPageSearchParams,
): SportsPageFilters {
  const view = firstValue(searchParams.view);
  const viewFilter = SPORTS_VIEWS.has(view as SportsPageFilters["view"])
    ? { view: view as SportsPageFilters["view"] }
    : {};
  const taxonomyType = firstValue(searchParams.taxonomy_type);
  const taxonomySlug = firstValue(searchParams.taxonomy_slug);
  if (
    TAXONOMY_TYPES.has(taxonomyType as SportsPageFilters["taxonomy_type"]) &&
    taxonomySlug
  ) {
    return {
      ...viewFilter,
      taxonomy_type: taxonomyType as TaxonomyType,
      taxonomy_slug: taxonomySlug,
    };
  }
  return viewFilter;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0] || undefined;
  return value || undefined;
}
