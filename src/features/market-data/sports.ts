import type {
  SportsInlineMarket,
  SportsMatchCard,
  SportsMatchDetail,
  SportsMarketOutcome,
  SportsPageData,
  SportsPropEventCard,
} from "../sports/types";

function structuralOutcome(outcome: SportsMarketOutcome): SportsMarketOutcome {
  const selected = { ...outcome };
  delete selected.price;
  delete selected.best_bid;
  delete selected.best_ask;
  delete selected.last_trade_price;
  return selected;
}

function structuralMarket(market: SportsInlineMarket): SportsInlineMarket {
  return {
    ...market,
    outcomes: market.outcomes?.map(structuralOutcome),
  };
}

function structuralMatch(match: SportsMatchCard): SportsMatchCard {
  return {
    ...match,
    inline_markets: match.inline_markets?.map(structuralMarket),
  };
}

export function sportsMatchesForMarketDataBranch(
  matches: SportsMatchCard[],
  enabled: boolean,
): SportsMatchCard[] {
  return enabled ? matches.map(structuralMatch) : matches;
}

export function sportsPropsForMarketDataBranch(
  props: SportsPropEventCard[],
  enabled: boolean,
): SportsPropEventCard[] {
  return enabled ? props.map(structuralProp) : props;
}

function structuralProp(prop: SportsPropEventCard): SportsPropEventCard {
  return {
    ...prop,
    markets: prop.markets?.map(structuralMarket),
  };
}

export function sportsPageForMarketDataBranch(
  data: SportsPageData,
  enabled: boolean,
): SportsPageData {
  if (!enabled) return data;
  return {
    ...data,
    matches: sportsMatchesForMarketDataBranch(data.matches, true),
    props: sportsPropsForMarketDataBranch(data.props, true),
  };
}

export function sportsMatchForMarketDataBranch(
  match: SportsMatchDetail,
  enabled: boolean,
): SportsMatchDetail {
  if (!enabled) return match;
  return {
    ...structuralMatch(match),
    market_groups: match.market_groups?.map((group) => ({
      ...group,
      markets: group.markets?.map(structuralMarket),
    })),
  };
}
