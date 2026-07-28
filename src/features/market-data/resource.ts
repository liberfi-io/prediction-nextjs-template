import type {
  MarketDataInitialQuotes,
  MarketDataResourceInput,
  MarketDataResourceState,
  MarketOutcome,
  MarketStructureResponse,
  PredictEvent,
} from "@liberfi.io/react-predict";

export interface BuildEventsMarketDataResourceInput {
  structure: MarketStructureResponse;
  structureETag: string;
  structurePath: string;
  initialQuotes?: MarketDataInitialQuotes;
}

export interface BuildEventMarketDataResourceInput extends Omit<
  BuildEventsMarketDataResourceInput,
  "initialQuotes"
> {
  event: PredictEvent;
}

export function buildEventsMarketDataResource({
  structure,
  structureETag,
  structurePath,
  initialQuotes,
}: BuildEventsMarketDataResourceInput): MarketDataResourceInput {
  return {
    key: `events:${structureETag}`,
    structure,
    structureETag,
    structurePath,
    initialQuotes,
    watch: {
      quote_events: structure.items.flatMap((item) =>
        item.resource_type === "event" && item.source
          ? [
              {
                source: item.source,
                event_slug: item.resource_slug,
                market_view: item.market_view,
              },
            ]
          : [],
      ),
    },
  };
}

export function buildEventMarketDataResource({
  structure,
  structureETag,
  structurePath,
  event,
}: BuildEventMarketDataResourceInput): MarketDataResourceInput {
  const item = structure.items.find(
    (candidate) =>
      candidate.resource_type === "event" &&
      candidate.resource_slug === event.slug &&
      candidate.source === event.source,
  );
  return {
    key: `event:${event.source}:${event.slug}:${structureETag}`,
    structure,
    structureETag,
    structurePath,
    initialQuotes: event.initial_quotes,
    watch: {
      quote_events: item
        ? [
            {
              source: event.source,
              event_slug: event.slug,
              market_view: item.market_view,
            },
          ]
        : [],
    },
  };
}

function structuralOutcome(outcome: MarketOutcome): MarketOutcome {
  const selected = { ...outcome };
  delete selected.price;
  delete selected.best_bid;
  delete selected.best_ask;
  return selected;
}

export function mergeMarketDataEvent(
  event: PredictEvent,
  state: MarketDataResourceState,
): PredictEvent {
  const quotes = new Map(
    (state.initialQuotes?.markets ?? []).flatMap((market) =>
      market.outcomes.map((outcome) => [
        `${market.source}\u0000${market.market_slug}\u0000${outcome.outcome}`,
        outcome,
      ]),
    ),
  );
  return {
    ...event,
    markets: event.markets?.map((market) => ({
      ...market,
      outcomes: market.outcomes.map((outcome) => {
        const selected = structuralOutcome(outcome);
        const quote = quotes.get(
          `${market.source}\u0000${market.slug}\u0000${outcome.key}`,
        );
        if (!quote?.bba.available) return selected;
        return {
          ...selected,
          ...(quote.bba.best_bid !== undefined
            ? { best_bid: quote.bba.best_bid }
            : {}),
          ...(quote.bba.best_ask !== undefined
            ? { best_ask: quote.bba.best_ask }
            : {}),
        };
      }),
    })),
  };
}
