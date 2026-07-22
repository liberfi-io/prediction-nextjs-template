import { TEAM_BUTTON_NEUTRAL, teamButtonColors } from "./team-button-colors";

describe("teamButtonColors", () => {
  it("chooses the higher-contrast text color", () => {
    expect(teamButtonColors("#ff00ff")).toMatchObject({
      bg: "#ff00ff",
      text: "#0a0a0b",
    });
    expect(teamButtonColors("#123456")).toMatchObject({
      bg: "#123456",
      text: "#ffffff",
    });
  });

  it("rejects invalid team colors without changing the neutral palette", () => {
    expect(teamButtonColors("red")).toBeUndefined();
    expect(teamButtonColors()).toBeUndefined();
    expect(TEAM_BUTTON_NEUTRAL.bg).toBe("#3f3f46");
  });
});
