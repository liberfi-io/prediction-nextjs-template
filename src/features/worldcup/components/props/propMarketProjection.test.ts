import type { WcProp } from "../../types";
import { projectWorldCupPropMarkets } from "./propMarketProjection";

const label = (outcome: WcProp["outcomes"][number]) => outcome.label;

describe("projectWorldCupPropMarkets", () => {
  it("groups a binary market by its structural market slug and keys", () => {
    const markets = projectWorldCupPropMarkets(
      prop([
        outcome("no", "Away", "binary-market"),
        outcome("yes", "Home", "binary-market"),
      ]),
      "Binary prop",
      label,
    );

    expect(markets).toEqual([
      expect.objectContaining({
        slug: "binary-market",
        question: "Binary prop",
        outcomes: [
          expect.objectContaining({ key: "no", label: "Away" }),
          expect.objectContaining({ key: "yes", label: "Home" }),
        ],
      }),
    ]);
  });

  it("uses original market slugs for candidate markets", () => {
    const markets = projectWorldCupPropMarkets(
      prop([
        outcome("yes", "Alice", "candidate-alice"),
        outcome("yes", "Bob", "candidate-bob"),
      ]),
      "Winner",
      label,
    );

    expect(markets.map((market) => market.slug)).toEqual([
      "candidate-alice",
      "candidate-bob",
    ]);
  });

  it("rejects a mixed keyed and unkeyed projection", () => {
    const invalid = outcome("yes", "Bob", "candidate-bob");
    invalid.key = undefined;

    expect(
      projectWorldCupPropMarkets(
        prop([outcome("yes", "Alice", "candidate-alice"), invalid]),
        "Winner",
        label,
      ),
    ).toEqual([]);
  });

  it("rejects missing slugs and duplicate keys within one market", () => {
    const missingSlug = outcome("yes", "Alice", "candidate-alice");
    missingSlug.marketSlug = undefined;
    expect(
      projectWorldCupPropMarkets(prop([missingSlug]), "Winner", label),
    ).toEqual([]);

    expect(
      projectWorldCupPropMarkets(
        prop([
          outcome("yes", "Home", "binary-market"),
          outcome("yes", "Away", "binary-market"),
        ]),
        "Binary prop",
        label,
      ),
    ).toEqual([]);
  });
});

function prop(outcomes: WcProp["outcomes"]): WcProp {
  return {
    slug: "prop-event",
    title: "Prop event",
    volume: 0,
    marketCount: outcomes.length,
    outcomes,
  };
}

function outcome(
  key: string,
  outcomeLabel: string,
  marketSlug: string,
): WcProp["outcomes"][number] {
  return {
    key,
    label: outcomeLabel,
    price: 0.5,
    marketSlug,
    marketSource: "polymarket",
  };
}
