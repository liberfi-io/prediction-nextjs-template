import type { SportsTaxonomyNode } from "../types";
import { isTaxonomyNodeActive, taxonomyHref } from "./sportsTaxonomyNav";

describe("sports taxonomy navigation", () => {
  const node: SportsTaxonomyNode = {
    section: "sports",
    node_type: "league",
    slug: "epl",
    label: "Premier League",
  };

  it("builds links from the slug, never the displayed label", () => {
    expect(taxonomyHref("sports", {}, node)).toBe("/sports?league_slug=epl");
    expect(taxonomyHref("sports", {}, { ...node, label: "英超" })).toBe(
      "/sports?league_slug=epl",
    );
  });

  it("builds an Esports sport link from its slug", () => {
    expect(
      taxonomyHref(
        "esports",
        {},
        {
          section: "esports",
          node_type: "sport",
          slug: "league-of-legends",
          label: "League of Legends",
        },
      ),
    ).toBe("/esports?sport_slug=league-of-legends");
  });

  it("determines active state from slug fields", () => {
    expect(
      isTaxonomyNodeActive({ sport_slug: "soccer", league_slug: "epl" }, node),
    ).toBe(true);
    expect(
      isTaxonomyNodeActive({ sport_slug: "soccer", league_slug: "lal" }, node),
    ).toBe(false);
  });

  it("only marks the most specific selected taxonomy node as active", () => {
    const sportNode: SportsTaxonomyNode = {
      section: "sports",
      node_type: "sport",
      slug: "soccer",
      label: "Soccer",
    };

    expect(isTaxonomyNodeActive({ sport_slug: "soccer" }, sportNode)).toBe(
      true,
    );
    expect(
      isTaxonomyNodeActive(
        { sport_slug: "soccer", league_slug: "epl" },
        sportNode,
      ),
    ).toBe(false);
    expect(
      isTaxonomyNodeActive(
        {
          sport_slug: "soccer",
          league_slug: "epl",
          tournament_slug: "premier-league-2026",
        },
        node,
      ),
    ).toBe(false);
  });
});
