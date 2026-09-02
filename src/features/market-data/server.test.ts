import {
  buildPredictApiUrl,
  getEventMarketDataHydration,
  getEventsMarketDataHydration,
  mergeSportsPageDataWithMarketDataHydration,
} from "./server";
import { marketStructureETag, marketStructureValidator } from "./structure";

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

  it("clears a degraded match result when market-data hydration has an authoritative page", () => {
    const result = mergeSportsPageDataWithMarketDataHydration(
      {
        taxonomy: null,
        matches: [],
        props: [],
        match_page_degraded: true,
        match_request_time_range: {
          start_time_gte: "2026-07-23T00:00:00Z",
          start_time_lt: "2026-07-24T00:00:00Z",
        },
      },
      {
        resources: {},
        pages: {
          matches: {
            items: [
              {
                match_group_slug: "hydrated-match",
                section: "sports",
                title: "Hydrated match",
              },
            ],
            has_more: false,
            limit: 20,
          },
        },
      },
    );

    expect(result.matches).toHaveLength(1);
    expect(result.match_page_degraded).toBeUndefined();
    expect(result.match_request_time_range).toBeUndefined();
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
      headers: new Headers(),
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
      expect(result?.resource.structureETag).toBe(
        marketStructureETag(
          marketStructureValidator(result?.resource.structure, null),
        ),
      );
      expect(result?.resource.structure.items[0]?.resource_slug).toBe("event");
      expect(result?.resource.initialQuotes?.markets[0]?.market_slug).toBe(
        "market",
      );
      expect(result?.page).toEqual(composite);
    } finally {
      global.fetch = originalFetch;
      process.env.PREDICT_URL = originalPredictUrl;
    }
  });

  it("preserves the backend validator for a pass-through detail route", async () => {
    const originalFetch = global.fetch;
    const originalPredictUrl = process.env.PREDICT_URL;
    const event = {
      slug: "event",
      source: "kalshi" as const,
      title: "Event",
      status: "open" as const,
      markets: [],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        "x-market-structure-etag": 'W/"backend-generation"',
      }),
      json: async () => event,
    });
    process.env.PREDICT_URL = "https://predict.example";

    try {
      const result = await getEventMarketDataHydration({
        enabled: true,
        event,
        requestHeaders: {},
      });

      expect(result?.event).toEqual(event);
      expect(result?.resource.structureETag).toBe('W/"backend-generation"');
    } finally {
      global.fetch = originalFetch;
      process.env.PREDICT_URL = originalPredictUrl;
    }
  });
});
