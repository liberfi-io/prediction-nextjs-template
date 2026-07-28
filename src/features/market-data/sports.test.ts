import type { SportsMatchDetail, SportsPageData } from "../sports/types";
import {
  sportsMatchForMarketDataBranch,
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
});
