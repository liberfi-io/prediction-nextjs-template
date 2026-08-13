import type { LeaderboardInterval } from "./types";

export const WORLDCUP_SCOPE = "worldcup_2026";

export type LeaderboardScope = "all" | typeof WORLDCUP_SCOPE;
export type LeaderboardView = "smart-money" | "live-feed";

export const INTERVAL_OPTIONS: LeaderboardInterval[] = ["1d", "7d", "30d", "all"];
export const DEFAULT_INTERVAL: LeaderboardInterval = "all";
export const DEFAULT_SCOPE: LeaderboardScope = "all";
// World Cup remains parseable for legacy deep links but is no longer exposed
// as a selectable leaderboard scope after the tournament ended.
export const SCOPES: LeaderboardScope[] = [DEFAULT_SCOPE];

const INTERVALS = new Set<LeaderboardInterval>(INTERVAL_OPTIONS);

function firstParam(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function parseInterval(
  value: string | string[] | null | undefined,
): LeaderboardInterval {
  const v = firstParam(value);
  return v && INTERVALS.has(v as LeaderboardInterval)
    ? (v as LeaderboardInterval)
    : DEFAULT_INTERVAL;
}

export function parseScope(
  value: string | string[] | null | undefined,
): LeaderboardScope {
  return firstParam(value) === WORLDCUP_SCOPE ? WORLDCUP_SCOPE : DEFAULT_SCOPE;
}

export function leaderboardTagForScope(scope: LeaderboardScope): string | null {
  return scope === WORLDCUP_SCOPE ? WORLDCUP_SCOPE : null;
}

export function buildLeaderboardSearch(params: {
  interval?: LeaderboardInterval;
  scope?: LeaderboardScope;
}): string {
  const qs = new URLSearchParams();
  if (params.interval && params.interval !== DEFAULT_INTERVAL) {
    qs.set("interval", params.interval);
  }
  if (params.scope && params.scope !== DEFAULT_SCOPE) {
    qs.set("scope", params.scope);
  }
  const text = qs.toString();
  return text ? `?${text}` : "";
}
