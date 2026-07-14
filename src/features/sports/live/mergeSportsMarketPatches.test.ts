import type { SportsMarketGroup } from "../types";
import { mergeSportsMarketPatches } from "./mergeSportsMarketPatches";

describe("mergeSportsMarketPatches", () => {
  it("updates matching market outcome prices", () => {
    const groups: SportsMarketGroup[] = [
      {
        market_category: "moneyline",
        label: "Moneyline",
        markets: [
          {
            market_slug: "france-spain-moneyline",
            label: "Winner",
            outcomes: [
              { outcome: "yes", label: "France", best_ask: 0.51 },
              { outcome: "no", label: "Spain", best_ask: 0.49 },
            ],
          },
        ],
      },
    ];

    expect(
      mergeSportsMarketPatches(groups, [
        {
          market_slug: "france-spain-moneyline",
          outcome: "yes",
          best_bid: 0.52,
          best_ask: 0.53,
          last_price: 0.54,
        },
      ]),
    ).toEqual([
      {
        market_category: "moneyline",
        label: "Moneyline",
        markets: [
          {
            market_slug: "france-spain-moneyline",
            label: "Winner",
            outcomes: [
              {
                outcome: "yes",
                label: "France",
                best_bid: 0.52,
                best_ask: 0.53,
                last_trade_price: 0.54,
              },
              { outcome: "no", label: "Spain", best_ask: 0.49 },
            ],
          },
        ],
      },
    ]);
  });

  it("does not create missing markets or outcomes", () => {
    const groups: SportsMarketGroup[] = [
      {
        market_category: "moneyline",
        label: "Moneyline",
        markets: [
          {
            market_slug: "france-spain-moneyline",
            label: "Winner",
            outcomes: [{ outcome: "yes", label: "France" }],
          },
        ],
      },
    ];

    expect(
      mergeSportsMarketPatches(groups, [
        {
          market_slug: "unknown",
          outcome: "yes",
          best_ask: 0.1,
        },
      ]),
    ).toBe(groups);
  });
});
