import type { SportsSection } from "../types";

export type SportsMatchChannelKind = "state" | "markets";

export interface SportsMatchStateUpdate {
  type: "sports_match_state_update";
  section: SportsSection;
  match_group_slug: string;
  live_source?: string;
  upstream_game_id?: string;
  status?: string;
  status_text?: string;
  period?: string;
  clock?: string;
  score_state?: unknown;
  observed_at_unix_ms?: number;
}

export interface SportsMarketPatch {
  market_slug: string;
  outcome?: "yes" | "no";
  best_bid?: number;
  best_ask?: number;
  last_price?: number;
}

export interface SportsMatchMarketUpdate {
  type: "sports_match_market_update";
  section: SportsSection;
  match_group_slug: string;
  markets: SportsMarketPatch[];
  ts_ms?: number;
}

export function sportsMatchChannel(
  section: SportsSection,
  matchGroupSlug: string,
  kind: SportsMatchChannelKind,
): string {
  return `${section}.match.${matchGroupSlug}.${kind}`;
}

export function isSportsMatchStateUpdate(
  value: unknown,
): value is SportsMatchStateUpdate {
  const update = value as SportsMatchStateUpdate;
  return (
    update?.type === "sports_match_state_update" &&
    isSportsSection(update.section) &&
    typeof update.match_group_slug === "string"
  );
}

export function isSportsMatchMarketUpdate(
  value: unknown,
): value is SportsMatchMarketUpdate {
  const update = value as SportsMatchMarketUpdate;
  return (
    update?.type === "sports_match_market_update" &&
    isSportsSection(update.section) &&
    typeof update.match_group_slug === "string" &&
    Array.isArray(update.markets)
  );
}

function isSportsSection(value: unknown): value is SportsSection {
  return value === "sports" || value === "esports";
}
