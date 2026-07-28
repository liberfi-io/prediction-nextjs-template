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

  it("hydrates structure, validator, and Initial Quote from one composite response", async () => {
    const originalFetch = global.fetch;
    const originalPredictUrl = process.env.PREDICT_URL;
    const composite = {
      items: [
        {
          slug: "event",
          source: "polymarket",
          title: "Event",
          status: "open",
          initial_quotes: {
            schema_version: 1,
            markets: [
              {
                source: "polymarket",
                market_slug: "market",
                realtime_supported: true,
                outcomes: [],
              },
            ],
          },
          markets: [
            {
              slug: "market",
              source: "polymarket",
              question: "Question",
              status: "open",
              realtime_supported: true,
              realtime_book_supported: false,
              outcomes: [],
            },
          ],
        },
      ],
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        "x-market-structure-etag": 'W/"composite-generation"',
      }),
      json: async () => composite,
    });
    global.fetch = fetchMock;
    process.env.PREDICT_URL = "https://predict.example";

    try {
      const result = await getEventsMarketDataHydration({
        enabled: true,
        params: { source: "polymarket" },
        requestHeaders: {},
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(
        new Headers(fetchMock.mock.calls[0]![1]!.headers).get("accept"),
      ).toBe("application/json");
      expect(result?.structureETag).toBe('W/"composite-generation"');
      expect(result?.structure.items[0]?.resource_slug).toBe("event");
      expect(result?.initialQuotes?.markets[0]?.market_slug).toBe("market");
    } finally {
      global.fetch = originalFetch;
      process.env.PREDICT_URL = originalPredictUrl;
    }
  });
});
