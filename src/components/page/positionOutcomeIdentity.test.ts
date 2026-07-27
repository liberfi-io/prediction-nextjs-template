import {
  resolveOpposedSidePositive,
  resolvePositionOutcome,
} from "./positionOutcomeIdentity";

describe("resolvePositionOutcome", () => {
  it("preserves canonical structural sides", () => {
    expect(resolvePositionOutcome({ side: "yes" })).toBe("yes");
    expect(resolvePositionOutcome({ side: "no" })).toBe("no");
  });

  it("uses only explicit market evidence for display-side mappings", () => {
    expect(resolvePositionOutcome({ side: "over", mapsOverUnder: true })).toBe(
      "yes",
    );
    expect(resolvePositionOutcome({ side: "odd", mapsOddEven: true })).toBe(
      "yes",
    );
    expect(resolvePositionOutcome({ side: "home", positiveSide: false })).toBe(
      "no",
    );
  });

  it("does not invent a side for an unknown position", () => {
    expect(resolvePositionOutcome({ side: "mystery" })).toBeUndefined();
  });

  it("requires an explicit match before choosing an opposed side", () => {
    const home = new Set(["home", "mexico"]);
    const away = new Set(["away", "canada"]);

    expect(resolveOpposedSidePositive("mexico", home, away)).toBe(true);
    expect(resolveOpposedSidePositive("canada", home, away)).toBe(false);
    expect(resolveOpposedSidePositive("mystery", home, away)).toBeUndefined();
  });
});
