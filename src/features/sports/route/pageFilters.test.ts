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
    expect(
      resolveSportsPageFilters({
        view: "results",
        start_time_gte: "2026-07-01T00:00:00Z",
        start_time_lt: "2026-07-23T00:00:00Z",
      }),
    ).toEqual({
      view: "results",
      start_time_gte: "2026-07-01T00:00:00Z",
      start_time_lt: "2026-07-23T00:00:00Z",
    });
    expect(resolveSportsPageFilters({ view: "unknown" })).toEqual({});
  });

  it("keeps a valid live range and rejects invalid ranges", () => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date("2026-07-23T08:00:00Z"));
    try {
      expect(
        resolveSportsPageFilters({
          view: "live",
          start_time_gte: "2026-07-30T00:00:00Z",
          start_time_lt: "2026-07-31T00:00:00Z",
          live_range_start: "2026-07-30T00:00:00Z",
        }),
      ).toEqual({
        view: "live",
        start_time_gte: "2026-07-30T00:00:00Z",
        start_time_lt: "2026-07-31T00:00:00Z",
        live_range_start: "2026-07-30T00:00:00Z",
      });
      expect(
        resolveSportsPageFilters({
          view: "live",
          start_time_gte: "2026-07-22T00:00:00Z",
          start_time_lt: "2026-07-23T00:00:00Z",
        }),
      ).toEqual({ view: "live" });
      expect(
        resolveSportsPageFilters({
          view: "live",
          start_time_gte: "2026-08-01T00:00:00Z",
          start_time_lt: "2026-08-02T00:00:00Z",
          live_range_start: "2026-07-23T00:00:00Z",
        }),
      ).toEqual({
        view: "live",
        start_time_gte: "2026-08-01T00:00:00Z",
        start_time_lt: "2026-08-02T00:00:00Z",
      });
      expect(
        resolveSportsPageFilters({
          view: "live",
          start_time_gte: "2026-08-06T00:00:00Z",
          start_time_lt: "2026-07-30T00:00:00Z",
        }),
      ).toEqual({ view: "live" });
      expect(
        resolveSportsPageFilters({
          view: "live",
          start_time_gte: "2026-07-30",
          start_time_lt: "2026-08-06",
        }),
      ).toEqual({ view: "live" });
      expect(
        resolveSportsPageFilters({
          view: "live",
          start_time_gte: "2026-02-30T00:00:00Z",
          start_time_lt: "2026-03-09T00:00:00Z",
        }),
      ).toEqual({ view: "live" });
    } finally {
      jest.useRealTimers();
    }
  });
});
