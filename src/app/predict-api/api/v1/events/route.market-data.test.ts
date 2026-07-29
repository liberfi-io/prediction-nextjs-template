/** @jest-environment node */ // eslint-disable-line jsdoc/check-tag-names

import { NextRequest } from "next/server";
import { GET } from "./route";

const STRUCTURE_MEDIA_TYPE =
  "application/vnd.liberfi.market-structure+json;v=1";

const openMarket = {
  source: "polymarket",
  market_slug: "market-open",
  slug: "market-open",
  question: "Open market",
  status: "open",
  realtime_supported: true,
  realtime_book_supported: true,
  outcomes: [
    {
      key: "yes",
      label: "Yes",
      price: 0.52,
      quote_capable: true,
      orderbook_capable: true,
      price_history_supported: true,
      book_channel: "market.book.polymarket.market-open.yes",
    },
  ],
};

const composite = {
  initial_quotes_contract_enabled: true,
  items: [
    {
      source: "polymarket",
      slug: "event-open",
      title: "Open event",
      status: "open",
      market_view: "full",
      markets_included: true,
      item_channel: "event.polymarket.event-open.markets",
      markets: [
        openMarket,
        {
          ...openMarket,
          slug: "market-closed",
          market_slug: "market-closed",
          status: "closed",
        },
      ],
    },
    {
      source: "polymarket",
      slug: "event-closed",
      title: "Closed event",
      status: "closed",
      markets: [openMarket],
    },
  ],
};

const structure = {
  representation_schema_version: 1,
  initial_quotes_contract_enabled: true,
  items: [
    {
      resource_type: "event",
      source: "polymarket",
      resource_slug: "event-open",
      title: "Open event",
      status: "open",
      market_view: "full",
      markets_included: true,
      item_channel: "event.polymarket.event-open.markets",
      markets: [openMarket],
    },
    {
      resource_type: "event",
      source: "polymarket",
      resource_slug: "event-closed",
      title: "Closed event",
      status: "closed",
      market_view: "full",
      markets_included: true,
      markets: [openMarket],
    },
  ],
};

function request(headers?: HeadersInit) {
  return new NextRequest("http://localhost/predict-api/api/v1/events", {
    headers,
  });
}

describe("events BFF market-data structure validator", () => {
  const originalPredictUrl = process.env.PREDICT_URL;

  beforeEach(() => {
    process.env.PREDICT_URL = "http://prediction.internal";
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env.PREDICT_URL = originalPredictUrl;
  });

  it("returns a BFF structural validator that ignores quote-only changes", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(Response.json(composite))
      .mockResolvedValueOnce(
        Response.json({
          ...composite,
          items: composite.items.map((item) => ({
            ...item,
            markets: item.markets.map((market) => ({
              ...market,
              outcomes: market.outcomes.map((outcome) => ({
                ...outcome,
                price: 0.99,
              })),
            })),
          })),
        }),
      );

    const first = await GET(request());
    const second = await GET(request());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    expect(first.headers.get("x-market-structure-etag")).toMatch(
      /^W\/"market-structure-v1-[A-Za-z0-9_-]{43}"$/,
    );
    expect(second.headers.get("x-market-structure-etag")).toBe(
      first.headers.get("x-market-structure-etag"),
    );
  });

  it("fetches structure unconditionally and applies the browser validator last", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        Promise.resolve(Response.json(structure, { status: 200 })),
      );

    const first = await GET(request({ accept: STRUCTURE_MEDIA_TYPE }));
    const etag = first.headers.get("etag");
    const second = await GET(
      request({
        accept: STRUCTURE_MEDIA_TYPE,
        "if-none-match": etag!,
      }),
    );

    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      items: [{ resource_slug: "event-open" }],
    });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
    expect(second.headers.get("etag")).toBe(etag);
    expect(second.headers.get("vary")).toBe("Accept");
    expect(second.headers.get("cache-control")).toBe("no-store");

    for (const [, init] of fetchMock.mock.calls) {
      const upstreamHeaders = new Headers(init?.headers);
      expect(upstreamHeaders.get("accept")).toBe(STRUCTURE_MEDIA_TYPE);
      expect(upstreamHeaders.has("if-none-match")).toBe(false);
      expect(init?.cache).toBe("no-store");
    }
  });

  it("does not reuse an upstream ETag after BFF filtering", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      Response.json(structure, {
        headers: { etag: 'W/"upstream"' },
      }),
    );

    const response = await GET(request({ accept: STRUCTURE_MEDIA_TYPE }));

    expect(response.headers.get("etag")).not.toBe('W/"upstream"');
    expect(response.headers.get("content-type")).toBe(STRUCTURE_MEDIA_TYPE);
    expect((await response.json()).items).toHaveLength(1);
  });

  it("uses one validator across composite and structure representations", async () => {
    const upstreamETag = 'W/"upstream-structure"';
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        Response.json(composite, {
          headers: { "x-market-structure-etag": upstreamETag },
        }),
      )
      .mockResolvedValueOnce(
        Response.json(structure, {
          headers: { etag: upstreamETag },
        }),
      );

    const compositeResponse = await GET(request());
    const structureResponse = await GET(
      request({ accept: STRUCTURE_MEDIA_TYPE }),
    );

    expect(compositeResponse.headers.get("x-market-structure-etag")).toBe(
      structureResponse.headers.get("etag"),
    );
  });
});
