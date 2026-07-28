import type { SportsMatchDetail } from "../types";
import { adaptSportsMatchDetail } from "./adaptSportsMatchDetail";

const detail: SportsMatchDetail = {
  source: "polymarket",
  match_group_slug: "chi-hai-jin-2026-07-25",
  section: "sports",
  sport_slug: "soccer",
  league_slug: "csl",
  title: "Qingdao Hainiu FC vs. Tianjin Jinmen Hu FC",
  status: "scheduled",
  start_time: "2026-07-25T17:30:00+08:00",
  participants: [
    {
      name: "Qingdao Hainiu FC",
      abbreviation: "HAI",
      role: "home",
      logo_url: "https://example.com/hai.png",
    },
    {
      name: "Tianjin Jinmen Hu FC",
      abbreviation: "JIN",
      role: "away",
      logo_url: "https://example.com/jin.png",
    },
  ],
  market_groups: [
    {
      market_category: "main",
      label: "Main",
      markets: [
        sportsMarket(
          "chi-hai-jin-2026-07-25-hai",
          "Will Qingdao Hainiu FC win?",
          0.35,
        ),
        sportsMarket(
          "chi-hai-jin-2026-07-25-draw",
          "Will the match end in a draw?",
          0.295,
        ),
        sportsMarket(
          "chi-hai-jin-2026-07-25-jin",
          "Will Tianjin Jinmen Hu FC win?",
          0.345,
        ),
      ],
    },
  ],
};

describe("adaptSportsMatchDetail", () => {
  it("builds the event and match models consumed by the shared detail page", () => {
    const result = adaptSportsMatchDetail(detail);

    expect(result.event).toMatchObject({
      slug: detail.match_group_slug,
      status: "open",
      source: "polymarket",
      volume: 30,
      liquidity: 300,
    });
    expect(result.event.markets).toHaveLength(3);
    expect(result.event.markets?.[0]).toMatchObject({
      event_slug: detail.match_group_slug,
      status: "open",
      outcomes: [
        { key: "yes", label: "Yes" },
        { key: "no", label: "No" },
      ],
      provider_meta: {
        "polymarket.sportsMarketType": "moneyline",
      },
    });
    expect(result.match).toMatchObject({
      slug: detail.match_group_slug,
      status: "scheduled",
      home: { code: "sports-hai", name: "Qingdao Hainiu FC" },
      away: { code: "sports-jin", name: "Tianjin Jinmen Hu FC" },
      moneyline: {
        home: { price: 0.35 },
        draw: { price: 0.295 },
        away: { price: 0.345 },
      },
    });
  });

  it("applies realtime market groups and live status", () => {
    const groups = detail.market_groups?.map((group) => ({
      ...group,
      markets: group.markets?.map((market) => ({
        ...market,
        outcomes: market.outcomes?.map((outcome) => ({
          ...outcome,
          price: outcome.outcome === "yes" ? 0.5 : outcome.price,
        })),
      })),
    }));

    const result = adaptSportsMatchDetail(detail, groups, {
      status: "live",
      status_text: "Second half",
      period: "2H",
      clock: "67:12",
      score_state: { home: "2", away: 1 },
    });

    expect(result.match.status).toBe("live");
    expect(result.match.liveScore).toEqual({ home: 2, away: 1 });
    expect(result.match.livePeriod).toBe("Second half · 2H · 67:12");
    expect(result.event.markets?.[0].outcomes[0].price).toBe(0.5);
    expect(result.event.end_at).toBeUndefined();
    expect(result.event.markets?.[0].end_at).toBeUndefined();
  });

  it("preserves the orderbook source on adapted markets", () => {
    const kalshiDetail: SportsMatchDetail = {
      ...detail,
      source: "kalshi",
      market_groups: detail.market_groups?.map((group) => ({
        ...group,
        markets: group.markets?.map((market) => ({
          ...market,
          source: "kalshi",
          outcomes: market.outcomes?.map((outcome) => ({
            ...outcome,
            orderbook: {
              market_slug: market.market_slug,
              source: "kalshi",
              outcome: outcome.outcome,
            },
          })),
        })),
      })),
    };

    const result = adaptSportsMatchDetail(kalshiDetail);

    expect(result.event.source).toBe("kalshi");
    expect(
      result.event.markets?.every((market) => market.source === "kalshi"),
    ).toBe(true);
  });

  it("rejects outcomes from mixed sources within one market", () => {
    const mixedDetail: SportsMatchDetail = {
      ...detail,
      market_groups: [
        {
          market_category: "main",
          label: "Main",
          markets: [
            {
              ...sportsMarket("mixed", "Mixed", 0.5),
              outcomes: [
                {
                  outcome: "yes",
                  label: "Yes",
                  orderbook: {
                    market_slug: "mixed",
                    source: "polymarket",
                    outcome: "yes",
                  },
                },
                {
                  outcome: "no",
                  label: "No",
                  orderbook: {
                    market_slug: "mixed",
                    source: "kalshi",
                    outcome: "no",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    expect(() => adaptSportsMatchDetail(mixedDetail)).toThrow(
      "Sports market mixed mixes data sources",
    );
  });

  it("rejects a market without a canonical source", () => {
    const sourceMissing: SportsMatchDetail = {
      ...detail,
      source: undefined,
      market_groups: detail.market_groups?.map((group) => ({
        ...group,
        markets: group.markets?.map((market) => ({
          ...market,
          source: undefined,
        })),
      })),
    };

    expect(() => adaptSportsMatchDetail(sourceMissing)).toThrow(
      "has no canonical source",
    );
  });
});

function sportsMarket(slug: string, label: string, price: number) {
  return {
    source: "polymarket" as const,
    market_slug: slug,
    market_type: "moneyline",
    label,
    active: true,
    closed: false,
    accepting_orders: true,
    volume: 10,
    liquidity: 100,
    outcomes: [
      { outcome: "yes" as const, label: "Yes", price },
      { outcome: "no" as const, label: "No", price: 1 - price },
    ],
  };
}
