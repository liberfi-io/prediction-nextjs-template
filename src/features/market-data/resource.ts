import type {
  MarketDataInitialQuotes,
  MarketDataResourceInput,
  MarketDataResourceState,
  MarketOutcome,
  MarketStructureResponse,
  Orderbook,
  PredictEvent,
  ProviderSource,
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
  selectedBook?: MarketDataSelectedBook;
}

export interface BuildSportsMarketDataResourceInput extends BuildEventsMarketDataResourceInput {
  section: "sports" | "esports";
  resource: "matches" | "props" | "detail";
  selectedBook?: MarketDataSelectedBook;
}

export interface MarketDataSelectedBook {
  source: ProviderSource;
  marketSlug: string;
  outcomeKey: string;
  displayOutcome?: "yes" | "no";
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
  selectedBook,
}: BuildEventMarketDataResourceInput): MarketDataResourceInput {
  const item = structure.items.find(
    (candidate) =>
      candidate.resource_type === "event" &&
      candidate.resource_slug === event.slug &&
      candidate.source === event.source,
  );
  const base: MarketDataResourceInput = {
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
  return selectedBook
    ? withEventMarketDataSelectedBook(base, selectedBook)
    : base;
}

export function withEventMarketDataSelectedBook(
  input: MarketDataResourceInput,
  selectedBook: MarketDataSelectedBook | null,
): MarketDataResourceInput {
  const baseKey = input.key.split(":book:", 1)[0]!;
  const { orderbook_market: _orderbookMarket, ...quoteWatch } = input.watch;
  const { bookChannel: _bookChannel, ...base } = input;
  if (!selectedBook) {
    return { ...base, key: baseKey, watch: quoteWatch };
  }
  const market = input.structure.items
    .flatMap((item) => item.markets)
    .find(
      (candidate) =>
        candidate.market_slug === selectedBook.marketSlug &&
        candidate.source === selectedBook.source,
    );
  const outcome = market?.outcomes.find(
    (candidate) => candidate.key === selectedBook.outcomeKey,
  );
  if (!market?.realtime_book_supported || !outcome?.book_channel) {
    return { ...base, key: baseKey, watch: quoteWatch };
  }
  return {
    ...base,
    key: `${baseKey}:book:${market.source}:${market.market_slug}:${outcome.key}`,
    watch: {
      ...quoteWatch,
      orderbook_market: {
        source: market.source,
        market_slug: market.market_slug,
      },
    },
    bookChannel: outcome.book_channel,
  };
}

export function buildSportsMarketDataResource({
  section,
  resource,
  structure,
  structureETag,
  structurePath,
  initialQuotes,
  selectedBook,
}: BuildSportsMarketDataResourceInput): MarketDataResourceInput {
  const quoteMarkets = new Map<
    string,
    { source: "polymarket" | "kalshi"; market_slug: string }
  >();
  structure.items.forEach((item) => {
    item.markets.forEach((market) => {
      if (!market.realtime_supported) return;
      quoteMarkets.set(`${market.source}\u0000${market.market_slug}`, {
        source: market.source,
        market_slug: market.market_slug,
      });
    });
  });
  const selectedMarket = selectedBook
    ? structure.items
        .flatMap((item) => item.markets)
        .find(
          (market) =>
            market.source === selectedBook.source &&
            market.market_slug === selectedBook.marketSlug,
        )
    : undefined;
  const selectedOutcome = selectedMarket?.outcomes.find(
    (outcome) => outcome.key === selectedBook?.outcomeKey,
  );
  const bookTarget =
    selectedMarket?.realtime_book_supported && selectedOutcome?.book_channel
      ? {
          source: selectedMarket.source,
          marketSlug: selectedMarket.market_slug,
          outcome: selectedOutcome.key,
          channel: selectedOutcome.book_channel,
        }
      : undefined;
  return {
    key:
      `${section}:${resource}:${structureETag}` +
      (bookTarget
        ? `:book:${bookTarget.source}:${bookTarget.marketSlug}:${bookTarget.outcome}`
        : ""),
    structure,
    structureETag,
    structurePath,
    initialQuotes,
    watch: {
      quote_markets: Array.from(quoteMarkets.values()),
      ...(bookTarget
        ? {
            orderbook_market: {
              source: bookTarget.source,
              market_slug: bookTarget.marketSlug,
            },
          }
        : {}),
    },
    ...(bookTarget ? { bookChannel: bookTarget.channel } : {}),
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

function orderbookLevels(
  levels: Array<{ price: string; size: string }> | undefined,
): Orderbook["bids"] {
  return (levels ?? []).flatMap((level) => {
    const price = Number(level.price);
    const size = Number(level.size);
    return Number.isFinite(price) &&
      price >= 0 &&
      price <= 1 &&
      Number.isFinite(size) &&
      size >= 0
      ? [{ price, size }]
      : [];
  });
}

export function eventOrderbooksFromMarketDataState(
  state: MarketDataResourceState,
): ReadonlyMap<string, Orderbook | null> {
  const books = new Map<string, Orderbook | null>();
  const snapshot = state.orderbooks;
  if (snapshot) {
    for (const orderbook of snapshot.orderbooks) {
      books.set(`${snapshot.market_slug}:${orderbook.outcome}`, {
        market_id: snapshot.market_slug,
        bids: orderbookLevels(orderbook.bids),
        asks: orderbookLevels(orderbook.asks),
      });
    }
  }
  const live = state.liveBook;
  if (live) {
    books.set(
      `${live.market_slug}:${live.outcome}`,
      live.available
        ? {
            market_id: live.market_slug,
            bids: orderbookLevels(live.bids),
            asks: orderbookLevels(live.asks),
          }
        : null,
    );
  }
  return books;
}
