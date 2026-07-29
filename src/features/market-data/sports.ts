import type {
  MarketDataOutcomeQuote,
  MarketDataResourceState,
  Orderbook,
} from "@liberfi.io/react-predict";
import type {
  SportsInlineMarket,
  SportsMatchCard,
  SportsMatchDetail,
  SportsMarketOutcome,
  SportsPageData,
  SportsPropEventCard,
} from "../sports/types";

type QuoteByOutcome = Map<string, MarketDataOutcomeQuote>;

function quoteKey(source: string, marketSlug: string, outcome: string): string {
  return `${source}\u0000${marketSlug}\u0000${outcome}`;
}

function orderbookLevels(
  levels: Array<{ price: string; size: string }> | undefined,
): Orderbook["bids"] {
  return (levels ?? []).flatMap((level) => {
    const price = Number(level.price);
    const size = Number(level.size);
    return Number.isFinite(price) && Number.isFinite(size)
      ? [{ price, size }]
      : [];
  });
}

export function sportsOrderbookForMarketDataBranch(
  state: MarketDataResourceState | undefined,
  marketSlug: string | undefined,
  outcomeKey: string | undefined,
  displayOutcome: "yes" | "no" | undefined,
): Orderbook | null {
  if (!state || !marketSlug || !outcomeKey || !displayOutcome) return null;
  const live = state.liveBook;
  if (live?.market_slug === marketSlug && live.outcome === outcomeKey) {
    if (!live.available) return null;
    return {
      market_id: marketSlug,
      outcome: displayOutcome,
      bids: orderbookLevels(live.bids),
      asks: orderbookLevels(live.asks),
    };
  }
  const snapshot = state.orderbooks?.orderbooks.find(
    (book) => book.outcome === outcomeKey,
  );
  if (state.orderbooks?.market_slug !== marketSlug || !snapshot) {
    return null;
  }
  return {
    market_id: marketSlug,
    outcome: displayOutcome,
    bids: orderbookLevels(snapshot.bids),
    asks: orderbookLevels(snapshot.asks),
  };
}

function quotesFromStates(states: MarketDataResourceState[]): QuoteByOutcome {
  return new Map(
    states.flatMap((state) =>
      (state.initialQuotes?.markets ?? []).flatMap((market) =>
        market.outcomes.map((outcome) => [
          quoteKey(market.source, market.market_slug, outcome.outcome),
          outcome,
        ]),
      ),
    ),
  );
}

function structuralOutcome(
  outcome: SportsMarketOutcome,
  marketSlug: string,
  quotes: QuoteByOutcome,
): SportsMarketOutcome {
  const selected = { ...outcome };
  delete selected.price;
  delete selected.best_bid;
  delete selected.best_ask;
  delete selected.last_trade_price;
  const source = outcome.orderbook?.source;
  const quote = source
    ? quotes.get(quoteKey(source, marketSlug, outcome.outcome))
    : undefined;
  if (quote?.bba.available) {
    selected.best_bid = quote.bba.best_bid;
    selected.best_ask = quote.bba.best_ask;
  }
  return selected;
}

function structuralMarket(
  market: SportsInlineMarket,
  quotes: QuoteByOutcome,
): SportsInlineMarket {
  return {
    ...market,
    outcomes: market.outcomes?.map((outcome) =>
      structuralOutcome(outcome, market.market_slug, quotes),
    ),
  };
}

function structuralMatch(
  match: SportsMatchCard,
  quotes: QuoteByOutcome,
): SportsMatchCard {
  return {
    ...match,
    inline_markets: match.inline_markets?.map((market) =>
      structuralMarket(market, quotes),
    ),
  };
}

function structuralProp(
  prop: SportsPropEventCard,
  quotes: QuoteByOutcome,
): SportsPropEventCard {
  return {
    ...prop,
    markets: prop.markets?.map((market) => structuralMarket(market, quotes)),
  };
}

export function sportsMatchesForMarketDataBranch(
  matches: SportsMatchCard[],
  enabled: boolean,
  states: MarketDataResourceState[] = [],
): SportsMatchCard[] {
  if (!enabled) return matches;
  const quotes = quotesFromStates(states);
  return matches.map((match) => structuralMatch(match, quotes));
}

export function sportsPropsForMarketDataBranch(
  props: SportsPropEventCard[],
  enabled: boolean,
  states: MarketDataResourceState[] = [],
): SportsPropEventCard[] {
  if (!enabled) return props;
  const quotes = quotesFromStates(states);
  return props.map((prop) => structuralProp(prop, quotes));
}

export function sportsPageForMarketDataBranch(
  data: SportsPageData,
  enabled: boolean,
  states: MarketDataResourceState[] = [],
): SportsPageData {
  if (!enabled) return data;
  return {
    ...data,
    matches: sportsMatchesForMarketDataBranch(data.matches, true, states),
    props: sportsPropsForMarketDataBranch(data.props, true, states),
  };
}

export function sportsMatchForMarketDataBranch(
  match: SportsMatchDetail,
  enabled: boolean,
  state?: MarketDataResourceState,
): SportsMatchDetail {
  if (!enabled) return match;
  const quotes = quotesFromStates(state ? [state] : []);
  return {
    ...structuralMatch(match, quotes),
    market_groups: match.market_groups?.map((group) => ({
      ...group,
      markets: group.markets?.map((market) => structuralMarket(market, quotes)),
    })),
  };
}
