import type { SportsMatchDetail } from "../types";
import { adaptSportsMatchDetail } from "./adaptSportsMatchDetail";

const detail: SportsMatchDetail = {
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
        sportsMarket("chi-hai-jin-2026-07-25-hai", "Will Qingdao Hainiu FC win?", 0.35),
        sportsMarket("chi-hai-jin-2026-07-25-draw", "Will the match end in a draw?", 0.295),
        sportsMarket("chi-hai-jin-2026-07-25-jin", "Will Tianjin Jinmen Hu FC win?", 0.345),
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

    const result = adaptSportsMatchDetail(detail, groups, { status: "live" });

    expect(result.match.status).toBe("live");
    expect(result.event.markets?.[0].outcomes[0].price).toBe(0.5);
  });
});

function sportsMarket(slug: string, label: string, price: number) {
  return {
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
