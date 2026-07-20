import { resolveSportsPageFilters } from "./pageFilters";

describe("resolveSportsPageFilters", () => {
  it("keeps only supported taxonomy query params", () => {
    expect(
      resolveSportsPageFilters({
        sport_slug: "soccer",
        league_slug: ["mlb", "ignored"],
        status: "live",
      }),
    ).toEqual({
      sport_slug: "soccer",
      league_slug: "mlb",
    });
  });

  it("accepts supported sports views and ignores unknown views", () => {
    expect(resolveSportsPageFilters({ view: "proposals" })).toEqual({
      view: "proposals",
    });
    expect(resolveSportsPageFilters({ view: "unknown" })).toEqual({});
  });
});
