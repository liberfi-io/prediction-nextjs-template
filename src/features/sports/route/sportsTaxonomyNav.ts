import type {
  SportsPageFilters,
  SportsSection,
  SportsTaxonomyNode,
} from "../types";

export function taxonomyHref(
  section: SportsSection,
  filters: SportsPageFilters,
  node: SportsTaxonomyNode,
): string {
  const params = new URLSearchParams();
  const nextFilters = taxonomyNodeFilter(filters, node);
  for (const [key, value] of Object.entries(nextFilters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `/${section}${query ? `?${query}` : ""}`;
}

export function taxonomyNodeFilter(
  filters: SportsPageFilters,
  node: SportsTaxonomyNode,
): SportsPageFilters {
  if (node.node_type === "sport") return { sport_slug: node.slug };
  if (node.node_type === "game") return { game_slug: node.slug };
  if (node.node_type === "league") {
    return {
      sport_slug: filters.sport_slug,
      game_slug: filters.game_slug,
      league_slug: node.slug,
    };
  }
  if (node.node_type === "tournament") {
    return {
      sport_slug: filters.sport_slug,
      game_slug: filters.game_slug,
      league_slug: filters.league_slug,
      tournament_slug: node.slug,
    };
  }
  return filters;
}

export function isTaxonomyNodeActive(
  filters: SportsPageFilters,
  node: SportsTaxonomyNode,
): boolean {
  if (node.node_type === "sport") {
    return (
      filters.sport_slug === node.slug &&
      !filters.league_slug &&
      !filters.tournament_slug
    );
  }
  if (node.node_type === "game") {
    return (
      filters.game_slug === node.slug &&
      !filters.league_slug &&
      !filters.tournament_slug
    );
  }
  if (node.node_type === "league") {
    return filters.league_slug === node.slug && !filters.tournament_slug;
  }
  if (node.node_type === "tournament") {
    return filters.tournament_slug === node.slug;
  }
  return false;
}
