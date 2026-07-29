import {
  marketStructureETag,
  marketStructureValidator,
  structureFromComposite,
} from "./structure";

describe("market structure validator", () => {
  it("depends only on the final transformed body", () => {
    const body = {
      items: [
        {
          resource_type: "event",
          source: "polymarket",
          resource_slug: "event",
          status: "open",
          markets_included: true,
          markets: [],
        },
      ],
    };

    expect(
      marketStructureETag(marketStructureValidator(body, 'W/"upstream-a"')),
    ).toBe(
      marketStructureETag(marketStructureValidator(body, 'W/"upstream-b"')),
    );
  });

  it.each([
    ["market_view", { market_view: "summary" }],
    ["item_channel", { item_channel: "event.polymarket.event.2" }],
    ["realtime_supported", { realtime_supported: false }],
    ["realtime_book_supported", { realtime_book_supported: false }],
    ["quote_capable", { quote_capable: false }],
    ["orderbook_capable", { orderbook_capable: false }],
    ["price_history_supported", { price_history_supported: false }],
    ["book_channel", { book_channel: "market.book.changed" }],
  ])("changes when %s changes", (_field, change) => {
    const body = {
      items: [
        {
          resource_type: "event",
          source: "polymarket",
          resource_slug: "event",
          status: "open",
          market_view: "full",
          markets_included: true,
          item_channel: "event.polymarket.event.1",
          markets: [
            {
              source: "polymarket",
              market_slug: "market",
              status: "open",
              realtime_supported: true,
              realtime_book_supported: true,
              outcomes: [
                {
                  key: "yes",
                  quote_capable: true,
                  orderbook_capable: true,
                  price_history_supported: true,
                  book_channel: "market.book.original",
                },
              ],
            },
          ],
        },
      ],
    };
    const changed = JSON.parse(JSON.stringify(body)) as typeof body;
    const item = changed.items[0]!;
    const market = item.markets[0]!;
    const outcome = market.outcomes[0]!;
    if ("market_view" in change || "item_channel" in change) {
      Object.assign(item, change);
    } else if (
      "realtime_supported" in change ||
      "realtime_book_supported" in change
    ) {
      Object.assign(market, change);
    } else {
      Object.assign(outcome, change);
    }

    expect(
      marketStructureETag(marketStructureValidator(changed, null)),
    ).not.toBe(marketStructureETag(marketStructureValidator(body, null)));
  });

  it("changes when schema, contract, or display structure changes", () => {
    const body = {
      representation_schema_version: 1,
      initial_quotes_contract_enabled: true,
      items: [
        {
          resource_type: "event",
          source: "polymarket",
          resource_slug: "event",
          title: "Event",
          title_trans: "Translated event",
          status: "open",
          market_view: "full",
          markets_included: true,
          markets: [
            {
              source: "polymarket",
              market_slug: "market",
              question: "Question",
              question_trans: "Translated question",
              status: "open",
              realtime_supported: true,
              realtime_book_supported: true,
              outcomes: [
                {
                  key: "yes",
                  label: "Yes",
                  label_trans: "Translated yes",
                  quote_capable: true,
                  orderbook_capable: true,
                  price_history_supported: true,
                },
              ],
            },
          ],
        },
      ],
    };
    const variants = [
      { path: ["representation_schema_version"], value: 2 },
      { path: ["initial_quotes_contract_enabled"], value: false },
      { path: ["items", 0, "title"], value: "Changed event" },
      { path: ["items", 0, "title_trans"], value: "Changed translation" },
      {
        path: ["items", 0, "markets", 0, "question"],
        value: "Changed question",
      },
      {
        path: ["items", 0, "markets", 0, "question_trans"],
        value: "Changed question translation",
      },
      {
        path: ["items", 0, "markets", 0, "outcomes", 0, "label"],
        value: "Changed label",
      },
      {
        path: ["items", 0, "markets", 0, "outcomes", 0, "label_trans"],
        value: "Changed label translation",
      },
    ];
    const baseETag = marketStructureETag(marketStructureValidator(body, null));

    for (const variant of variants) {
      const changed = JSON.parse(JSON.stringify(body)) as Record<
        string,
        unknown
      >;
      let target: Record<string, unknown> | unknown[] = changed;
      variant.path.slice(0, -1).forEach((segment) => {
        target = target[segment as keyof typeof target] as
          | Record<string, unknown>
          | unknown[];
      });
      target[variant.path.at(-1) as keyof typeof target] =
        variant.value as never;
      expect(
        marketStructureETag(marketStructureValidator(changed, null)),
      ).not.toBe(baseETag);
    }
  });

  it("projects nested sports markets from the same composite", () => {
    const structure = structureFromComposite(
      {
        items: [
          {
            slug: "match",
            title: "Match",
            status: "open",
            market_groups: [
              {
                markets: [
                  {
                    market_slug: "winner",
                    label: "Winner",
                    status: "open",
                    realtime_supported: true,
                    realtime_book_supported: true,
                    outcomes: [
                      {
                        outcome: "home",
                        label: "Home",
                        orderbook: {
                          source: "polymarket",
                          book_channel: "market.book.polymarket.winner.home",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      } as never,
      null,
    );

    expect(structure).toMatchObject({
      items: [
        {
          markets: [
            {
              source: "polymarket",
              market_slug: "winner",
              outcomes: [
                {
                  key: "home",
                  book_channel: "market.book.polymarket.winner.home",
                },
              ],
            },
          ],
        },
      ],
    });
  });
});
