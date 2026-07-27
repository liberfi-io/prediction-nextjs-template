import { adaptSmartMoneyLiveActivity } from "./liveFeedAdapter";

describe("adaptSmartMoneyLiveActivity", () => {
  it("preserves structural outcome keys from the shared market fixture", () => {
    const activity = adaptSmartMoneyLiveActivity({
      activity_id: "activity-1",
      type: "buy",
      market: {
        slug: "market-1",
        outcomes: [
          { key: "yes", label: "Home" },
          { key: "no", label: "Away" },
        ],
      },
    });

    expect(activity?.market?.outcomes).toEqual([
      { key: "yes", label: "Home" },
      { key: "no", label: "Away" },
    ]);
  });
});
