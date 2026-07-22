import type { PredictMarket } from "@liberfi.io/react-predict";
import { allGroups, categorizeMarkets } from "./marketGrouping";

describe("categorizeMarkets", () => {
  it("keeps unknown generic sports markets tradeable in the Other category", () => {
    const market: PredictMarket = {
      slug: "baseball-first-five-innings",
      event_slug: "baseball-match",
      question: "First five innings winner",
      status: "open",
      outcomes: [
        { label: "Home", price: 0.55 },
        { label: "Away", price: 0.45 },
      ],
      source: "polymarket",
      provider_meta: {
        "polymarket.sportsMarketType": "baseball_first_five_innings",
      },
    };

    const categories = categorizeMarkets([market]);

    expect(categories.other).toHaveLength(1);
    expect(allGroups(categories)[0].options[0].market.slug).toBe(market.slug);
  });
});
