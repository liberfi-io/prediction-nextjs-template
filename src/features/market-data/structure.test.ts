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
