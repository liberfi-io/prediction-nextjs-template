export type SportsSection = "sports" | "esports";

export interface SportsTaxonomyNode {
  section?: SportsSection;
  node_type?: string;
  slug: string;
  label: string;
  count?: number;
  children?: SportsTaxonomyNode[];
}

export interface SportsTaxonomySection {
  section: SportsSection;
  children: SportsTaxonomyNode[];
}

export interface SportsTaxonomyResponse {
  sections?: SportsTaxonomySection[];
}

export interface SportsParticipant {
  name: string;
  role?: string;
  slug?: string;
  logo_url?: string;
  abbreviation?: string;
}

export interface SportsLiveState {
  status?: string;
  status_text?: string;
  clock?: string | null;
  period?: string | null;
  score?: unknown;
  score_state?: unknown;
  observed_at_unix_ms?: number;
}

export interface SportsMarketOutcome {
  outcome: "yes" | "no";
  label: string;
  price?: number;
  best_bid?: number;
  best_ask?: number;
  last_trade_price?: number;
  orderbook?: {
    market_slug: string;
    source: "polymarket";
    outcome: "yes" | "no";
  };
}

export interface SportsInlineMarket {
  market_slug: string;
  market_type?: string;
  label: string;
  outcomes?: SportsMarketOutcome[];
}

export interface SportsMarket extends SportsInlineMarket {
  condition_id?: string;
  market_category?: string;
  period?: string;
  line?: number;
  active?: boolean;
  closed?: boolean;
  accepting_orders?: boolean;
  volume?: number;
  liquidity?: number;
}

export interface SportsMarketGroup {
  market_category: string;
  label: string;
  markets?: SportsMarket[];
}

export interface SportsMatchCard {
  match_group_slug: string;
  section: SportsSection;
  sport_slug?: string;
  game_slug?: string;
  league_slug?: string;
  title: string;
  status?: string;
  start_time?: string;
  participants?: SportsParticipant[];
  market_count?: number;
  live_state?: SportsLiveState;
  inline_markets?: SportsInlineMarket[];
}

export interface SportsMatchDetail extends SportsMatchCard {
  market_groups?: SportsMarketGroup[];
}

export interface SportsPropEventCard {
  event_slug: string;
  event_type?: string;
  prop_type?: string;
  section: SportsSection;
  sport_slug?: string;
  game_slug?: string;
  league_slug?: string;
  tournament_slug?: string;
  title: string;
  status?: string;
  parent_match_group_slug?: string;
  markets?: SportsInlineMarket[];
}

export interface SportsPageData {
  taxonomy: SportsTaxonomyResponse | null;
  matches: SportsMatchCard[];
  props: SportsPropEventCard[];
}

export interface SportsPageFilters {
  sport_slug?: string;
  game_slug?: string;
  league_slug?: string;
  tournament_slug?: string;
}
