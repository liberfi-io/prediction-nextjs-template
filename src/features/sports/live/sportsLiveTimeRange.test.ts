import { sportsLiveTimeRange } from "./sportsLiveTimeRange";

describe("sportsLiveTimeRange", () => {
  it("returns a seven-day UTC half-open RFC3339 range", () => {
    expect(
      sportsLiveTimeRange(new Date("2026-07-23T00:30:00Z")),
    ).toEqual({
      start_time_gte: "2026-07-23T00:00:00Z",
      start_time_lt: "2026-07-30T00:00:00Z",
    });
    expect(
      sportsLiveTimeRange(new Date("2026-07-22T23:30:00Z")),
    ).toEqual({
      start_time_gte: "2026-07-22T00:00:00Z",
      start_time_lt: "2026-07-29T00:00:00Z",
    });
  });
});
