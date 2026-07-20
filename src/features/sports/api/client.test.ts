import { fetchNextSportsPage } from "./client";

describe("fetchNextSportsPage", () => {
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

    await fetchNextSportsPage({
      section: "esports",
      resource: "matches",
      taxonomy: {
        taxonomy_type: "game",
        taxonomy_slug: "league-of-legends",
      },
      limit: 20,
      cursor,
    });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe("/predict-api/api/v1/esports/matches");
    expect(requestedUrl.searchParams.get("taxonomy_type")).toBe("game");
    expect(requestedUrl.searchParams.get("taxonomy_slug")).toBe(
      "league-of-legends",
    );
    expect(requestedUrl.searchParams.get("cursor")).toBe(cursor);
    expect(requestedUrl.searchParams.has("sport_slug")).toBe(false);
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
      fetchNextSportsPage({
        section: "sports",
        resource: "props",
        limit: 20,
        cursor: "previous",
      }),
    ).resolves.toMatchObject({ has_more: false });
  });
});
