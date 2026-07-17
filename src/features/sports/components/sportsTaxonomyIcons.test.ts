import { resolveSportsTaxonomyIcon } from "./sportsTaxonomyIcons";

describe("resolveSportsTaxonomyIcon", () => {
  it("resolves top-level sports and esports icons", () => {
    expect(resolveSportsTaxonomyIcon("soccer")).toBe(
      "/sports/taxonomy/soccer.svg",
    );
    expect(resolveSportsTaxonomyIcon("league_of_legends")).toBe(
      "/sports/taxonomy/league-of-legends.svg",
    );
    expect(resolveSportsTaxonomyIcon("mobile-legends-bang-bang")).toBe(
      "/sports/taxonomy/mobile-legends.jpg",
    );
  });

  it("resolves curated competitions and regional leagues", () => {
    expect(resolveSportsTaxonomyIcon("soccer-fifwc")).toBe(
      "/sports/taxonomy/world-cup.png",
    );
    expect(resolveSportsTaxonomyIcon("brazil-serie-a")).toBe(
      "/sports/taxonomy/countries/bra.png",
    );
    expect(resolveSportsTaxonomyIcon("csl")).toBe(
      "/sports/taxonomy/chinese-super-league.png",
    );
    expect(resolveSportsTaxonomyIcon("gtm")).toBe(
      "/sports/taxonomy/countries/gtm.png",
    );
  });

  it("inherits the parent icon when no dedicated asset exists", () => {
    expect(
      resolveSportsTaxonomyIcon(
        "unknown-league",
        "/sports/taxonomy/soccer.svg",
      ),
    ).toBe("/sports/taxonomy/soccer.svg");
  });
});
