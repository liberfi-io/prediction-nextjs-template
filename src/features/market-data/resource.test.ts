import type {
  MarketDataResourceState,
  MarketStructureResponse,
  PredictEvent,
} from "@liberfi.io/react-predict";
import {
  buildEventMarketDataResource,
  buildEventsMarketDataResource,
  buildSportsMarketDataResource,
  eventOrderbooksFromMarketDataState,
  mergeMarketDataEvent,
  withEventMarketDataSelectedBook,
} from "./resource";

const event: PredictEvent = {
  slug: "event",
  title: "Event",
  status: "open",
  source: "polymarket",
  markets: [
    {
      slug: "market",
      event_slug: "event",
      question: "Question",
      status: "open",
      source: "polymarket",
      outcomes: [
        { key: "yes", label: "Yes" },
        { key: "no", label: "No" },
      ],
    },
  ],
};

const structure: MarketStructureResponse = {
  representation_schema_version: 1,
  initial_quotes_contract_enabled: true,
  items: [
    {
      resource_type: "event",
      source: "polymarket",
      resource_slug: "event",
      title: "Event",
      status: "open",
      market_view: "full",
      markets_included: true,
      item_channel: "event.polymarket.event.markets",
      markets: [
        {
          source: "polymarket",
          market_slug: "market",
          question: "Question",
          status: "open",
          realtime_supported: true,
          realtime_book_supported: true,
          outcomes: [
            {
              key: "yes",
              label: "Yes",
              quote_capable: true,
              orderbook_capable: true,
              price_history_supported: true,
              book_channel: "market.book.polymarket.market.yes",
            },
          ],
        },
      ],
    },
  ],
};

describe("events market data resource", () => {
  it("uses structure channels and watches the complete page", () => {
    const input = buildEventsMarketDataResource({
      structure,
      structureETag: 'W/"etag"',
      structurePath: "/api/v1/events?source=polymarket",
    });

    expect(input.key).toBe('events:W/"etag"');
    expect(input.watch.quote_events).toEqual([
      {
        source: "polymarket",
        event_slug: "event",
        market_view: "full",
      },
    ]);
  });

  it("builds a detail resource with one complete event watch", () => {
    const input = buildEventMarketDataResource({
      structure,
      structureETag: 'W/"detail"',
      structurePath: "/api/v1/events/event?source=polymarket",
      event,
    });

    expect(input.key).toBe('event:polymarket:event:W/"detail"');
    expect(input.initialQuotes).toBe(event.initial_quotes);
    expect(input.watch.quote_events).toHaveLength(1);
  });

  it("atomically replaces and clears the selected event book", () => {
    const input = buildEventMarketDataResource({
      structure,
      structureETag: 'W/"detail"',
      structurePath: "/api/v1/events/event?source=polymarket",
      event,
    });

    const selected = withEventMarketDataSelectedBook(input, {
      marketSlug: "market",
      outcome: "yes",
    });
    expect(selected.key).toBe(
      'event:polymarket:event:W/"detail":book:polymarket:market:yes',
    );
    expect(selected.watch.quote_events).toEqual(input.watch.quote_events);
    expect(selected.watch.orderbook_market).toEqual({
      source: "polymarket",
      market_slug: "market",
    });
    expect(selected.bookChannel).toBe(
      "market.book.polymarket.market.yes",
    );

    const cleared = withEventMarketDataSelectedBook(selected, null);
    expect(cleared.key).toBe('event:polymarket:event:W/"detail"');
    expect(cleared.watch.quote_events).toEqual(input.watch.quote_events);
    expect(cleared.watch.orderbook_market).toBeUndefined();
    expect(cleared.bookChannel).toBeUndefined();
  });

  it("builds a sports resource from provider-neutral market keys", () => {
    const input = buildSportsMarketDataResource({
      section: "sports",
      resource: "matches",
      structure,
      structureETag: 'W/"sports"',
      structurePath: "/api/v1/sports/matches",
      selectedBook: { marketSlug: "market", outcome: "yes" },
    });

    expect(input.key).toBe(
      'sports:matches:W/"sports":book:polymarket:market:yes',
    );
    expect(input.watch.quote_markets).toEqual([
      { source: "polymarket", market_slug: "market" },
    ]);
    expect(input.watch.orderbook_market).toEqual({
      source: "polymarket",
      market_slug: "market",
    });
    expect(input.bookChannel).toBe("market.book.polymarket.market.yes");
  });

  it("merges available quotes by public outcome key without structural fallback", () => {
    const state: MarketDataResourceState = {
      key: "events",
      generation: 1,
      phase: "live",
      initialQuotes: {
        schema_version: 1,
        markets: [
          {
            source: "polymarket",
            market_slug: "market",
            realtime_supported: true,
            outcomes: [
              {
                source: "polymarket",
                market_slug: "market",
                outcome: "yes",
                bba: {
                  available: true,
                  empty: false,
                  best_bid: 0.52,
                  best_ask: 0.54,
                },
                last_trade: { available: false },
                tick_size: { available: false },
              },
            ],
          },
        ],
      },
    };

    const merged = mergeMarketDataEvent(event, state);

    expect(merged.markets![0]!.outcomes).toEqual([
      { key: "yes", label: "Yes", best_bid: 0.52, best_ask: 0.54 },
      { key: "no", label: "No" },
    ]);
  });

  it("maps plural books by outcome and lets the live book replace its snapshot", () => {
    const state: MarketDataResourceState = {
      key: "event",
      generation: 1,
      phase: "live",
      orderbooks: {
        schema_version: 1,
        source: "polymarket",
        market_slug: "market",
        orderbooks: [
          {
            outcome: "yes",
            observed_at: "2026-07-28T00:00:00Z",
            bids: [{ price: "0.40", size: "10" }],
            asks: [{ price: "0.60", size: "12" }],
          },
          {
            outcome: "no",
            observed_at: "2026-07-28T00:00:00Z",
            bids: [{ price: "0.45", size: "8" }],
            asks: [{ price: "0.55", size: "9" }],
          },
        ],
      },
      liveBook: {
        schema_version: 1,
        available: true,
        source: "polymarket",
        market_slug: "market",
        outcome: "yes",
        observed_at: "2026-07-28T00:00:01Z",
        bids: [{ price: "0.41", size: "11" }],
        asks: [{ price: "0.59", size: "13" }],
      },
    };

    const books = eventOrderbooksFromMarketDataState(state);

    expect(books.get("market:yes")).toMatchObject({
      bids: [{ price: 0.41, size: 11 }],
      asks: [{ price: 0.59, size: 13 }],
    });
    expect(books.get("market:no")).toMatchObject({
      bids: [{ price: 0.45, size: 8 }],
      asks: [{ price: 0.55, size: 9 }],
    });
  });

  it("ignores protocol outcomes that the orderbook UI cannot represent", () => {
    const state: MarketDataResourceState = {
      key: "event",
      generation: 1,
      phase: "live",
      liveBook: {
        schema_version: 1,
        available: true,
        source: "polymarket",
        market_slug: "market",
        outcome: "draw",
        observed_at: "2026-07-28T00:00:01Z",
        bids: [{ price: "0.50", size: "10" }],
        asks: [{ price: "0.51", size: "10" }],
      },
    };

    expect(eventOrderbooksFromMarketDataState(state).size).toBe(0);
  });
});
