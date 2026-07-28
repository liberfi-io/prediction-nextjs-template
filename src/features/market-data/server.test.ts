import { buildPredictApiUrl, getEventsMarketDataHydration } from "./server";

describe("market data SSR hydration", () => {
  it("preserves a configured prediction API base path", () => {
    expect(
      buildPredictApiUrl(
        "https://api.example.test/staging/predict",
        "/api/v1/events",
      ).toString(),
    ).toBe("https://api.example.test/staging/predict/api/v1/events");
  });

  it("does not fetch structure when the capability is disabled", async () => {
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock;

    try {
      const result = await getEventsMarketDataHydration({
        enabled: false,
        params: { source: "polymarket" },
        requestHeaders: {},
      });

      expect(result).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
