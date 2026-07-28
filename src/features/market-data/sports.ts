import type {
  MarketDataOutcomeQuote,
  MarketDataResourceState,
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

function quotesFromStates(states: MarketDataResourceState[]): QuoteByOutcome {
  return new Map(
    states.flatMap((state) =>
      (state.initialQuotes?.markets ?? []).flatMap((market) =>
        market.outcomes.map((outcome) => [
          `${market.market_slug}\u0000${outcome.outcome}`,
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
  const quote = quotes.get(`${marketSlug}\u0000${outcome.outcome}`);
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
