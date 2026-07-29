import {
  isSportsNavigationEnabled,
  resolveMarketDataFeatureCapability,
  resolveSportsFeatureFlags,
  resolveSportsNavigationEnabled,
} from "./featureFlags";

describe("resolveMarketDataFeatureCapability", () => {
  it.each(["true", "TRUE", "True"])(
    "enables only an exact case-insensitive true value: %s",
    (value) => {
      expect(
        resolveMarketDataFeatureCapability({
          NEXT_PUBLIC_MARKET_DATA_REALTIME_V1_ENABLED: value,
        }),
      ).toEqual({ enabled: true });
    },
  );

  it.each([undefined, "", "1", "yes", " true", "true "])(
    "fails closed for %p",
    (value) => {
      expect(
        resolveMarketDataFeatureCapability({
          NEXT_PUBLIC_MARKET_DATA_REALTIME_V1_ENABLED: value,
        }),
      ).toEqual({ enabled: false });
    },
  );
});

describe("resolveSportsFeatureFlags", () => {
  it("enables sports list and match detail pages by default", () => {
    expect(resolveSportsFeatureFlags({})).toEqual({
      sports_enabled: true,
      esports_enabled: true,
      sports_match_detail_enabled: true,
      sports_match_detail_soccer_enabled: false,
      sports_match_detail_baseball_enabled: false,
      esports_match_detail_cs2_enabled: false,
    });
  });

  it("keeps sport-specific detail flags explicit", () => {
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
      esports_enabled: true,
      sports_match_detail_enabled: true,
      sports_match_detail_soccer_enabled: false,
      sports_match_detail_baseball_enabled: false,
      esports_match_detail_cs2_enabled: true,
    });
  });

  it("allows sports list pages to be disabled explicitly", () => {
    expect(
      resolveSportsFeatureFlags({
        NEXT_PUBLIC_ENABLE_SPORTS: "false",
        NEXT_PUBLIC_ENABLE_ESPORTS: "false",
      }),
    ).toMatchObject({
      sports_enabled: false,
      esports_enabled: false,
    });
  });
});

describe("isSportsNavigationEnabled", () => {
  const flags = resolveSportsFeatureFlags({});

  it("shows Sports and Esports navigation when their list flags are enabled", () => {
    expect(isSportsNavigationEnabled("sports", flags)).toBe(true);
    expect(isSportsNavigationEnabled("esports", flags)).toBe(true);
  });

  it("can hide Sports and Esports navigation without disabling their pages", () => {
    const navigationEnabled = resolveSportsNavigationEnabled({
      NEXT_PUBLIC_ENABLE_SPORTS_NAVIGATION: "false",
    });

    expect(navigationEnabled).toBe(false);
    expect(isSportsNavigationEnabled("sports", flags, navigationEnabled)).toBe(
      false,
    );
    expect(isSportsNavigationEnabled("esports", flags, navigationEnabled)).toBe(
      false,
    );
    expect(isSportsNavigationEnabled("events", flags, navigationEnabled)).toBe(
      true,
    );
  });

  it("does not apply Sports flags to unrelated navigation items", () => {
    expect(isSportsNavigationEnabled("events", flags)).toBe(true);
  });
});
