import type { SportsFeatureFlags } from "src/libs/featureFlags";
import { createSportsSsrDeadline } from "./sportsSsrDeadline";
import { resolveSportsEventRoute } from "./resolveSportsEventRoute";

const enabledFlags: SportsFeatureFlags = {
  sports_enabled: true,
  esports_enabled: true,
  sports_match_detail_enabled: true,
  sports_match_detail_soccer_enabled: true,
  sports_match_detail_baseball_enabled: false,
  esports_match_detail_cs2_enabled: false,
};

function baseInput() {
  return {
    slug: "france-spain",
    searchParams: new URLSearchParams(),
    lang: "en",
    flags: enabledFlags,
    deadline: createSportsSsrDeadline(3000),
    resolveWorldcupAttribution: () => null,
    fetchSportsRouting: jest.fn().mockResolvedValue({
      route_type: "not_sports",
      slug: "france-spain",
    }),
    fetchFallbackEvent: jest.fn().mockResolvedValue(null),
  };
}

describe("resolveSportsEventRoute", () => {
  it("keeps World Cup match routing before Sports feature flags", async () => {
    const input = {
      ...baseInput(),
      flags: { ...enabledFlags, sports_enabled: false },
      resolveWorldcupAttribution: () => ({
        kind: "match" as const,
        matchSlug: "wc-match",
      }),
    };

    await expect(resolveSportsEventRoute(input)).resolves.toEqual({
      kind: "worldcup_match",
      slug: "wc-match",
    });
    expect(input.fetchSportsRouting).not.toHaveBeenCalled();
  });

  it("falls back to traditional event when Sports is disabled", async () => {
    const input = {
      ...baseInput(),
      flags: { ...enabledFlags, sports_enabled: false, esports_enabled: false },
      fetchFallbackEvent: jest.fn().mockResolvedValue({ event_slug: "legacy" }),
    };

    await expect(resolveSportsEventRoute(input)).resolves.toEqual({
      kind: "fallback_event",
      event_slug: "legacy",
    });
    expect(input.fetchSportsRouting).not.toHaveBeenCalled();
  });

  it("returns skeleton when match routing succeeds but detail is unavailable", async () => {
    const input = {
      ...baseInput(),
      fetchSportsRouting: jest.fn().mockResolvedValue({
        route_type: "match",
        slug: "france-spain",
        section: "sports" as const,
        match_group_slug: "france-spain",
      }),
      fetchSportsMatchDetail: jest.fn().mockResolvedValue(null),
    };

    await expect(resolveSportsEventRoute(input)).resolves.toEqual({
      kind: "sports_match_skeleton",
      match_group_slug: "france-spain",
      section: "sports",
    });
  });

  it("merges canonical child redirects without legacy deep-link params", async () => {
    const input = {
      ...baseInput(),
      searchParams: new URLSearchParams({
        market: "moneyline",
        outcome: "no",
        condition_id: "0xabc",
      }),
      fetchSportsRouting: jest.fn().mockResolvedValue({
        route_type: "child_redirect",
        slug: "child",
        section: "sports" as const,
        redirect_to: "/sports/matches/france-spain",
      }),
    };

    await expect(resolveSportsEventRoute(input)).resolves.toEqual({
      kind: "sports_child_redirect",
      redirect_to: "/sports/matches/france-spain?market=moneyline&outcome=no",
    });
  });
});
