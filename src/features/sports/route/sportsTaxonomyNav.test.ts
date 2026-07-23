import type { SportsTaxonomyNode } from "../types";
import { isTaxonomyNodeActive, taxonomyHref } from "./sportsTaxonomyNav";

describe("sports taxonomy navigation", () => {
  const node: SportsTaxonomyNode = {
    section: "sports",
    node_type: "league",
    slug: "epl",
    label: "Premier League",
  };

  it("builds links from the node type and slug", () => {
    expect(taxonomyHref("sports", node)).toBe(
      "/sports?taxonomy_type=league&taxonomy_slug=epl",
    );
    expect(taxonomyHref("sports", { ...node, label: "英超" })).toBe(
      "/sports?taxonomy_type=league&taxonomy_slug=epl",
    );
  });

  it("uses the game node type for an Esports category", () => {
    expect(
      taxonomyHref("esports", {
        section: "esports",
        node_type: "game",
        slug: "league-of-legends",
        label: "League of Legends",
      }),
    ).toBe("/esports?taxonomy_type=game&taxonomy_slug=league-of-legends");
  });

  it("keeps taxonomy switches inside the live view", () => {
    expect(taxonomyHref("sports", node, "live")).toBe(
      "/sports?view=live&taxonomy_type=league&taxonomy_slug=epl",
    );
  });

  it("preserves the selected live range in taxonomy links", () => {
    expect(
      taxonomyHref("sports", node, "live", {
        start_time_gte: "2026-07-30T00:00:00Z",
        start_time_lt: "2026-07-31T00:00:00Z",
      }),
    ).toBe(
      "/sports?view=live&start_time_gte=2026-07-30T00%3A00%3A00Z&start_time_lt=2026-07-31T00%3A00%3A00Z&taxonomy_type=league&taxonomy_slug=epl",
    );
  });

  it("determines active state from both canonical taxonomy fields", () => {
    expect(
      isTaxonomyNodeActive(
        { taxonomy_type: "league", taxonomy_slug: "epl" },
        node,
      ),
    ).toBe(true);
    expect(
      isTaxonomyNodeActive(
        { taxonomy_type: "tournament", taxonomy_slug: "epl" },
        node,
      ),
    ).toBe(false);
  });
});
