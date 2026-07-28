import {
  fetchSportsPage,
  fetchSportsPageWithMarketData,
  fetchSportsTaxonomyCounts,
} from "./client";

describe("fetchSportsPage", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as { fetch?: typeof fetch }).fetch;
  });

  it("passes the opaque next cursor and canonical taxonomy pair unchanged", async () => {
    const cursor = "opaque+/= cursor:value";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        next_cursor: null,
        has_more: false,
        limit: 20,
      }),
    });
    global.fetch = fetchMock;

    await fetchSportsPage({
      section: "esports",
      resource: "matches",
      view: "live",
      taxonomy: {
        taxonomy_type: "game",
        taxonomy_slug: "league-of-legends",
      },
      limit: 20,
      cursor,
      timeRange: {
        start_time_gte: "2026-07-23T00:00:00Z",
        start_time_lt: "2026-07-30T00:00:00Z",
      },
    });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe("/predict-api/api/v1/esports/matches");
    expect(requestedUrl.searchParams.get("taxonomy_type")).toBe("game");
    expect(requestedUrl.searchParams.get("taxonomy_slug")).toBe(
      "league-of-legends",
    );
    expect(requestedUrl.searchParams.get("cursor")).toBe(cursor);
    expect(requestedUrl.searchParams.get("start_time_gte")).toBe(
      "2026-07-23T00:00:00Z",
    );
    expect(requestedUrl.searchParams.get("start_time_lt")).toBe(
      "2026-07-30T00:00:00Z",
    );
    expect(requestedUrl.searchParams.has("sport_slug")).toBe(false);
    expect(requestedUrl.searchParams.get("view")).toBe("live");
  });

  it("stops pagination when either server continuation field is empty", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [],
        next_cursor: "cursor",
        has_more: false,
        limit: 20,
      }),
    });

    await expect(
      fetchSportsPage({
        section: "sports",
        resource: "props",
        limit: 20,
        cursor: "previous",
      }),
    ).resolves.toMatchObject({ has_more: false });
  });

  it("loads the matching structure generation for a paginated market-data page", async () => {
    const cursor = "opaque+/= cursor:value";
    const structure = {
      representation_schema_version: 1,
      initial_quotes_contract_enabled: true,
      items: [
        {
          resource_type: "match",
          source: "polymarket",
          resource_slug: "match",
          title: "Match",
          status: "open",
          market_view: "full",
          markets_included: true,
          item_channel: "match.polymarket.match.markets",
          markets: [],
        },
      ],
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
          next_cursor: null,
          has_more: false,
          limit: 20,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ etag: 'W/"next-page"' }),
        json: async () => structure,
      });

    const result = await fetchSportsPageWithMarketData({
      section: "sports",
      resource: "matches",
      view: "live",
      limit: 20,
      cursor,
      marketDataEnabled: true,
    });

    expect(result.marketDataResource).toMatchObject({
      key: 'sports:matches:W/"next-page"',
      structureETag: 'W/"next-page"',
      structurePath:
        "/api/v1/sports/matches?view=live&limit=20&cursor=opaque%2B%2F%3D+cursor%3Avalue",
      structure,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const structureRequest = jest.mocked(global.fetch).mock.calls[1]!;
    expect(new Headers(structureRequest[1]?.headers).get("accept")).toBe(
      "application/vnd.liberfi.market-structure+json;v=1",
    );
  });

  it("loads taxonomy counts for the selected live UTC range", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            taxonomy_type: "league",
            taxonomy_slug: "mlb",
            match_count: 7,
          },
        ],
      }),
    });

    await expect(
      fetchSportsTaxonomyCounts({
        start_time_gte: "2026-07-23T00:00:00Z",
        start_time_lt: "2026-07-30T00:00:00Z",
      }),
    ).resolves.toEqual([
      {
        taxonomy_type: "league",
        taxonomy_slug: "mlb",
        match_count: 7,
      },
    ]);

    const requestedUrl = new URL(
      String(jest.mocked(global.fetch).mock.calls[0]?.[0]),
    );
    expect(requestedUrl.pathname).toBe(
      "/predict-api/api/v1/sports/matches/taxonomy-counts",
    );
    expect(requestedUrl.searchParams.get("start_time_gte")).toBe(
      "2026-07-23T00:00:00Z",
    );
    expect(requestedUrl.searchParams.get("start_time_lt")).toBe(
      "2026-07-30T00:00:00Z",
    );
    expect(requestedUrl.searchParams.has("status")).toBe(false);
    expect(requestedUrl.searchParams.get("view")).toBe("live");
  });
});
