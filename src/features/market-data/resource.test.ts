import type {
  MarketDataResourceState,
  MarketStructureResponse,
  PredictEvent,
} from "@liberfi.io/react-predict";
import {
  buildEventMarketDataResource,
  buildEventsMarketDataResource,
  mergeMarketDataEvent,
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
});
