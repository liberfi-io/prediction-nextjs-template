import type {
  MarketDataInitialQuotes,
  ProviderSource,
} from "@liberfi.io/react-predict";
import type { SportsLiveTimeRange } from "./live/sportsLiveTimeRange";

export type SportsSection = "sports" | "esports";

export type TaxonomyType = "sport" | "game" | "league" | "tournament";

export interface SportsTaxonomyNode {
  section?: SportsSection;
  node_type: TaxonomyType;
  slug: string;
  label: string;
  counts?: SportsTaxonomyCounts | null;
  children?: SportsTaxonomyNode[];
}

export interface SportsTaxonomyCounts {
  match_count: number;
  prop_count: number;
  total_count: number;
}

export interface SportsTaxonomyMatchCount {
  taxonomy_type: TaxonomyType;
  taxonomy_slug: string;
  match_count: number;
}

export interface SportsTaxonomySection {
  section: SportsSection;
  featured?: SportsTaxonomyNode[];
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
  color?: string;
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
    source: ProviderSource;
    outcome: "yes" | "no";
  };
}

export interface SportsInlineMarket {
  source?: ProviderSource;
  market_slug: string;
  market_type?: string;
  condition_id?: string;
  label: string;
  line?: number;
  status?: "pending" | "open" | "closed" | "voided";
  provider_meta?: Record<string, unknown>;
  outcomes?: SportsMarketOutcome[];
}

export interface SportsMarket extends SportsInlineMarket {
  condition_id?: string;
  market_category?: string;
  period?: string;
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
  source?: ProviderSource;
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
  volume?: number;
  live_state?: SportsLiveState;
  inline_markets?: SportsInlineMarket[];
  initial_quotes?: MarketDataInitialQuotes;
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
  image_url?: string;
  volume?: number;
  status?: string;
  start_time?: string;
  parent_match_group_slug?: string;
  markets?: SportsInlineMarket[];
  initial_quotes?: MarketDataInitialQuotes;
}

export interface SportsPageData {
  taxonomy: SportsTaxonomyResponse | null;
  matches: SportsMatchCard[];
  props: SportsPropEventCard[];
  match_page_degraded?: boolean;
  match_request_time_range?: SportsLiveTimeRange;
  match_taxonomy_counts?: SportsTaxonomyMatchCount[];
  match_pagination?: SportsPagination;
  prop_pagination?: SportsPagination;
}

export interface SportsPagination {
  next_cursor?: string | null;
  has_more: boolean;
  limit: number;
}

export interface SportsPage<T> extends SportsPagination {
  items: T[];
}

interface SportsViewFilter {
  view?: "live" | "upcoming" | "results" | "proposals";
}

interface SportsLiveRangeFilter {
  start_time_gte?: string;
  start_time_lt?: string;
  live_range_start?: string;
}

export interface TaxonomySelection {
  taxonomy_type: TaxonomyType;
  taxonomy_slug: string;
}

export type SportsPageFilters = SportsViewFilter &
  SportsLiveRangeFilter &
  (
    | TaxonomySelection
    | { taxonomy_type?: undefined; taxonomy_slug?: undefined }
  );

/** Converts a taxonomy node into the canonical list API parameters. */
export function taxonomyParams(node: SportsTaxonomyNode): TaxonomySelection {
  return {
    taxonomy_type: node.node_type,
    taxonomy_slug: node.slug,
  };
}
