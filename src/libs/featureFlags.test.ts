import { resolveSportsFeatureFlags } from "./featureFlags";

describe("resolveSportsFeatureFlags", () => {
  it("only treats literal true as enabled", () => {
    expect(
      resolveSportsFeatureFlags({
        NEXT_PUBLIC_ENABLE_SPORTS: "true",
        NEXT_PUBLIC_ENABLE_ESPORTS: "TRUE",
        NEXT_PUBLIC_ENABLE_SPORTS_MATCH_DETAIL: "1",
        NEXT_PUBLIC_ENABLE_SPORTS_MATCH_DETAIL_SOCCER: "",
        NEXT_PUBLIC_ENABLE_SPORTS_MATCH_DETAIL_BASEBALL: "false",
        NEXT_PUBLIC_ENABLE_ESPORTS_MATCH_DETAIL_CS2: "true",
      }),
    ).toEqual({
      sports_enabled: true,
      esports_enabled: false,
      sports_match_detail_enabled: false,
      sports_match_detail_soccer_enabled: false,
      sports_match_detail_baseball_enabled: false,
      esports_match_detail_cs2_enabled: true,
    });
  });
});
