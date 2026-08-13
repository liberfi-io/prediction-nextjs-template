import {
  DEFAULT_SCOPE,
  parseScope,
  SCOPES,
  WORLDCUP_SCOPE,
} from "./routeParams";

describe("leaderboard scopes", () => {
  it("only exposes the active all-markets scope in the leaderboard UI", () => {
    expect(SCOPES).toEqual([DEFAULT_SCOPE]);
  });

  it("continues to parse legacy World Cup scope links", () => {
    expect(parseScope(WORLDCUP_SCOPE)).toBe(WORLDCUP_SCOPE);
  });
});
