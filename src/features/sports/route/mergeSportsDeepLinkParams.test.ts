import { mergeSportsDeepLinkParams } from "./mergeSportsDeepLinkParams";

describe("mergeSportsDeepLinkParams", () => {
  it("keeps market slug and binary outcome only", () => {
    const searchParams = new URLSearchParams({
      market: "france-vs-spain-moneyline",
      outcome: "yes",
      market_group: "legacy",
      m: "short",
      condition_id: "0xabc",
    });

    expect(
      mergeSportsDeepLinkParams({
        redirectTo: "/sports/matches/france-spain",
        searchParams,
      }),
    ).toBe(
      "/sports/matches/france-spain?market=france-vs-spain-moneyline&outcome=yes",
    );
  });

  it("drops unknown market slugs and non-binary outcomes", () => {
    const searchParams = new URLSearchParams({
      market: "unknown",
      outcome: "France",
    });

    expect(
      mergeSportsDeepLinkParams({
        redirectTo: "/sports/matches/france-spain?existing=1",
        searchParams,
        knownMarketSlugs: new Set(["known"]),
      }),
    ).toBe("/sports/matches/france-spain?existing=1");
  });
});
