import {
  isSportsMatchMarketUpdate,
  isSportsMatchStateUpdate,
  sportsMatchChannel,
} from "./channels";

describe("sports live channels", () => {
  it("matches backend Centrifugo channel names", () => {
    expect(sportsMatchChannel("sports", "france-spain", "state")).toBe(
      "sports.match.france-spain.state",
    );
    expect(sportsMatchChannel("esports", "navi-vitality", "markets")).toBe(
      "esports.match.navi-vitality.markets",
    );
  });

  it("guards state and market update payloads", () => {
    expect(
      isSportsMatchStateUpdate({
        type: "sports_match_state_update",
        section: "sports",
        match_group_slug: "france-spain",
      }),
    ).toBe(true);
    expect(
      isSportsMatchMarketUpdate({
        type: "sports_match_market_update",
        section: "esports",
        match_group_slug: "navi-vitality",
        markets: [],
      }),
    ).toBe(true);
    expect(
      isSportsMatchMarketUpdate({
        type: "sports_match_market_update",
        section: "sports",
        match_group_slug: "france-spain",
      }),
    ).toBe(false);
  });
});
