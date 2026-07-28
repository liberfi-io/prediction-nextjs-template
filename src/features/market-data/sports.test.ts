import type { MarketDataResourceState } from "@liberfi.io/react-predict";
import type { SportsMatchDetail, SportsPageData } from "../sports/types";
import {
  sportsMatchForMarketDataBranch,
  sportsOrderbookForMarketDataBranch,
  sportsPageForMarketDataBranch,
} from "./sports";

const outcome = {
  outcome: "yes" as const,
  label: "Home",
  price: 0.4,
  best_bid: 0.49,
  best_ask: 0.51,
  last_trade_price: 0.5,
};

describe("sports market data compatibility branch", () => {
  it("preserves legacy data when disabled", () => {
    const data: SportsPageData = {
      taxonomy: null,
      matches: [],
      props: [],
    };
    expect(sportsPageForMarketDataBranch(data, false)).toBe(data);
  });

  it("removes structural price fallbacks from list and detail data", () => {
    const data: SportsPageData = {
      taxonomy: null,
      matches: [
        {
          match_group_slug: "match",
          section: "sports",
          title: "Match",
          inline_markets: [
            {
              market_slug: "market",
              label: "Winner",
              outcomes: [outcome],
            },
          ],
        },
      ],
      props: [
        {
          event_slug: "prop",
          section: "sports",
          title: "Prop",
          markets: [
            {
              market_slug: "prop-market",
              label: "Prop",
              outcomes: [outcome],
            },
          ],
        },
      ],
    };
    const detail: SportsMatchDetail = {
      ...data.matches[0]!,
      market_groups: [
        {
          market_category: "moneyline",
          label: "Moneyline",
          markets: [
            {
              market_slug: "market",
              label: "Winner",
              outcomes: [outcome],
            },
          ],
        },
      ],
    };

    const selectedPage = sportsPageForMarketDataBranch(data, true);
    const selectedDetail = sportsMatchForMarketDataBranch(detail, true);

    expect(selectedPage.matches[0]!.inline_markets![0]!.outcomes![0]).toEqual({
      outcome: "yes",
      label: "Home",
    });
    expect(selectedDetail.market_groups![0]!.markets![0]!.outcomes![0]).toEqual(
      {
        outcome: "yes",
        label: "Home",
      },
    );
  });

  it("prefers the live provider-neutral book over the cache snapshot", () => {
    const state: MarketDataResourceState = {
      key: "sports:detail",
      generation: 1,
      phase: "live",
      orderbooks: {
        schema_version: 1,
        source: "polymarket",
        market_slug: "market",
        orderbooks: [
          {
            outcome: "yes",
            observed_at: "2026-07-28T00:00:00Z",
            bids: [{ price: "0.40", size: "10" }],
            asks: [{ price: "0.60", size: "12" }],
          },
        ],
      },
      liveBook: {
        schema_version: 1,
        available: true,
        source: "polymarket",
        market_slug: "market",
        outcome: "yes",
        observed_at: "2026-07-28T00:00:01Z",
        bids: [{ price: "0.49", size: "20" }],
        asks: [{ price: "0.51", size: "21" }],
      },
    };

    expect(sportsOrderbookForMarketDataBranch(state, "market", "yes")).toEqual({
      market_id: "market",
      outcome: "yes",
      bids: [{ price: 0.49, size: 20 }],
      asks: [{ price: 0.51, size: 21 }],
    });
  });

  it("renders unavailable when the live book explicitly becomes unavailable", () => {
    const state: MarketDataResourceState = {
      key: "sports:detail",
      generation: 1,
      phase: "degraded_book",
      liveBook: {
        schema_version: 1,
        available: false,
        source: "polymarket",
        market_slug: "market",
        outcome: "yes",
        observed_at: "2026-07-28T00:00:01Z",
      },
    };

    expect(
      sportsOrderbookForMarketDataBranch(state, "market", "yes"),
    ).toBeNull();
  });

  it("keeps quotes isolated by the public source, market, and outcome key", () => {
    const data: SportsPageData = {
      taxonomy: null,
      matches: [
        {
          match_group_slug: "match",
          section: "sports",
          title: "Match",
          inline_markets: [
            {
              market_slug: "shared-market",
              label: "Winner",
              outcomes: [
                {
                  outcome: "yes",
                  label: "Home",
                  orderbook: {
                    source: "polymarket",
                    market_slug: "shared-market",
                    outcome: "yes",
                  },
                },
              ],
            },
          ],
        },
      ],
      props: [],
    };
    const states: MarketDataResourceState[] = [
      quoteState("polymarket", "0.41", "0.43"),
      quoteState("kalshi", "0.71", "0.73"),
    ];

    expect(
      sportsPageForMarketDataBranch(data, true, states).matches[0]!
        .inline_markets![0]!.outcomes![0],
    ).toMatchObject({ best_bid: 0.41, best_ask: 0.43 });
  });
});

function quoteState(
  source: "polymarket" | "kalshi",
  bestBid: string,
  bestAsk: string,
): MarketDataResourceState {
  return {
    key: source,
    generation: 1,
    phase: "live",
    initialQuotes: {
      schema_version: 1,
      markets: [
        {
          source,
          market_slug: "shared-market",
          realtime_supported: true,
          outcomes: [
            {
              source,
              market_slug: "shared-market",
              outcome: "yes",
              bba: {
                available: true,
                empty: false,
                best_bid: Number(bestBid),
                best_ask: Number(bestAsk),
                observed_at: "2026-07-28T00:00:00Z",
              },
              last_trade: {
                available: false,
                observed_at: "2026-07-28T00:00:00Z",
              },
              tick_size: {
                available: false,
                observed_at: "2026-07-28T00:00:00Z",
              },
            },
          ],
        },
      ],
    },
  };
}
