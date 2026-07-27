import { resolveRedeemOutcome } from "./predictOutcomeIdentity";
import type { PredictEvent } from "@liberfi.io/react-predict";

describe("resolveRedeemOutcome", () => {
  const reorderedOutcomes = [
    { key: "no", label: "Away" },
    { key: "yes", label: "Home" },
  ];

  it("uses structural keys instead of array order", () => {
    expect(resolveRedeemOutcome("yes", reorderedOutcomes)).toBe("yes");
    expect(resolveRedeemOutcome("no", reorderedOutcomes)).toBe("no");
  });

  it("accepts canonical side keys directly", () => {
    expect(resolveRedeemOutcome("yes", reorderedOutcomes)).toBe("yes");
    expect(resolveRedeemOutcome("no", reorderedOutcomes)).toBe("no");
  });

  it("does not derive identity from a display label", () => {
    expect(resolveRedeemOutcome("Home", reorderedOutcomes)).toBeUndefined();
    expect(resolveRedeemOutcome("Away", reorderedOutcomes)).toBeUndefined();
    expect(resolveRedeemOutcome("Draw", reorderedOutcomes)).toBeUndefined();
  });

  it("rejects missing and duplicate structural identities", () => {
    expect(
      resolveRedeemOutcome("yes", [
        { key: "", label: "Home" },
        { key: "no", label: "Away" },
      ]),
    ).toBeUndefined();
    expect(
      resolveRedeemOutcome("yes", [
        { key: "yes", label: "Home" },
        { key: "yes", label: "Away" },
      ]),
    ).toBeUndefined();
    expect(
      resolveRedeemOutcome("yes", [
        { label: "Home" },
        { key: "no", label: "Away" },
      ]),
    ).toBeUndefined();
    expect(
      resolveRedeemOutcome("yes", [
        { key: 1, label: "Home" },
        { key: "no", label: "Away" },
      ]),
    ).toBeUndefined();
  });

  it("consumes keyed outcomes from the shared event response", () => {
    const fixture = JSON.parse(`{
      "slug": "fixture-event",
      "title": "Fixture event",
      "status": "open",
      "source": "polymarket",
      "markets": [{
        "slug": "fixture-market",
        "event_slug": "fixture-event",
        "question": "Fixture question",
        "status": "open",
        "source": "polymarket",
        "outcomes": [
          {"key": "no", "label": "Away"},
          {"key": "yes", "label": "Home"}
        ]
      }]
    }`) as PredictEvent;

    expect(resolveRedeemOutcome("yes", fixture.markets?.[0]?.outcomes)).toBe(
      "yes",
    );
  });
});
