import { resolveSportsPageFilters } from "./pageFilters";

describe("resolveSportsPageFilters", () => {
  it("keeps a complete canonical taxonomy pair and ignores legacy params", () => {
    expect(
      resolveSportsPageFilters({
        taxonomy_type: "league",
        taxonomy_slug: ["mlb", "ignored"],
        sport_slug: "baseball",
      }),
    ).toEqual({ taxonomy_type: "league", taxonomy_slug: "mlb" });
  });

  it("drops incomplete or unsupported taxonomy filters", () => {
    expect(resolveSportsPageFilters({ taxonomy_type: "category" })).toEqual({});
    expect(resolveSportsPageFilters({ taxonomy_slug: "mlb" })).toEqual({});
  });

  it("accepts supported sports views and ignores unknown views", () => {
    expect(resolveSportsPageFilters({ view: "proposals" })).toEqual({
      view: "proposals",
    });
    expect(resolveSportsPageFilters({ view: "unknown" })).toEqual({});
  });
});
