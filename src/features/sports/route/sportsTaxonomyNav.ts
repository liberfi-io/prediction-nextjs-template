import type {
  SportsPageFilters,
  SportsSection,
  SportsTaxonomyNode,
} from "../types";
import { taxonomyParams } from "../types";

export function taxonomyHref(
  section: SportsSection,
  node: SportsTaxonomyNode,
): string {
  const params = new URLSearchParams();
  const nextFilters = taxonomyNodeFilter(node);
  for (const [key, value] of Object.entries(nextFilters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `/${section}${query ? `?${query}` : ""}`;
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
