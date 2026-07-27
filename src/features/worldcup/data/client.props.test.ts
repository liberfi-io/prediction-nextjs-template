import type {
  WcMarketDto,
  WcOutcomeDto,
  WcPropEventDto,
} from "./client";
import { adaptProps } from "./client";

describe("adaptProps", () => {
  it("accepts an exact binary market", () => {
    const adapted = adaptProps({
      props: [
        prop([
          market("binary-market", [
            outcome("No", "no-token"),
            outcome("Yes", "yes-token"),
          ]),
        ]),
      ],
    });

    expect(adapted[0]?.outcomes).toEqual([
      expect.objectContaining({
        key: "yes",
        marketSlug: "binary-market",
        tokenId: "yes-token",
      }),
      expect.objectContaining({
        key: "no",
        marketSlug: "binary-market",
        tokenId: "no-token",
      }),
    ]);
  });

  it.each([
    ["duplicate binary side", ["Yes", "Yes", "No"]],
    ["ambiguous candidate sides", ["Alice", "Bob", "No"]],
    ["missing candidate side", ["No"]],
  ])("rejects %s", (_name, names) => {
    const adapted = adaptProps({
      props: [
        prop([
          market(
            "invalid-market",
            names.map((name, index) => outcome(name, `token-${index}`)),
          ),
        ]),
      ],
    });

    expect(adapted).toEqual([]);
  });

  it("rejects the whole prop when any candidate market is ambiguous", () => {
    const adapted = adaptProps({
      props: [
        prop([
          market("alice-market", [
            outcome("Alice", "alice-token"),
            outcome("No", "alice-no-token"),
          ]),
          market("broken-market", [
            outcome("Bob", "bob-token"),
            outcome("Carol", "carol-token"),
            outcome("No", "broken-no-token"),
          ]),
        ]),
      ],
    });

    expect(adapted).toEqual([]);
  });
});

function prop(markets: WcMarketDto[]): WcPropEventDto {
  return {
    slug: "prop-event",
    title: "Prop event",
    display_order: 1,
    markets,
    market_count: markets.length,
  };
}

function market(slug: string, outcomes: WcOutcomeDto[]): WcMarketDto {
  return {
    slug,
    source: "polymarket",
    condition_id: `condition-${slug}`,
    sports_market_type: "prop",
    question: "Prop question",
    status: "open",
    outcomes,
  };
}

function outcome(name: string, tokenId: string): WcOutcomeDto {
  return {
    name,
    token_id: tokenId,
    price: 0.5,
  };
}
