/**
 * World Cup BFF client + adapter (ADR-6: self-contained in the template).
 *
 * Talks to prediction-server `GET /api/v1/worldcup/matches` and adapts the
 * snake_case transport DTO into the local {@link WcMatch} domain shape the UI
 * consumes. The endpoint takes no query params and returns every group-stage
 * match with an inline subset of markets (3 moneyline + 1 spread + 1 total)
 * plus the true total market count; date grouping / stage switching stay
 * client-side.
 */

import type {
  WcMatch,
  WcMatchStatus,
  WcMoneyline,
  WcSpread,
  WcTeam,
  WcTotal,
} from "../types";
import { getTeam } from "./teams";
import { GROUP_MATCHES, THESPORTS_MATCH_IDS } from "./schedule";
import { deriveStatus } from "../logic/match-status";

// ---------------------------------------------------------------------------
// Backend transport DTOs (snake_case, mirror internal/domain/worldcup.go)
// ---------------------------------------------------------------------------

export interface WcOutcomeDto {
  token_id?: string;
  name: string;
  price?: number;
  best_ask?: number;
}

export interface WcMarketDto {
  condition_id: string;
  sports_market_type: string;
  group_item_title?: string;
  group_item_threshold?: string;
  line?: number;
  question: string;
  status: string;
  outcomes: WcOutcomeDto[] | null;
}

export interface WcTeamInfoDto {
  team_code: string;
  name: string;
  flag_url: string;
  color: string;
  abbreviation: string;
}

export interface WcMatchDto {
  match_id: string;
  stage: string;
  group_code: string;
  home_team: WcTeamInfoDto;
  away_team: WcTeamInfoDto;
  kickoff_at: string;
  status: string;
  polymarket_slug: string;
  title: string;
  /** TheSports feed id (static config); omitted for undrawn knockout fixtures. */
  thesports_id?: string;
  /** Aggregated USD figures; omitted (not 0) when markets are not yet ingested. */
  volume?: number;
  volume_24h?: number;
  liquidity?: number;
  markets: WcMarketDto[] | null;
  market_count: number;
}

export interface WcMatchesResponseDto {
  matches: WcMatchDto[] | null;
}

// ---------------------------------------------------------------------------
// Static supplements (fields the matches endpoint does not return)
// ---------------------------------------------------------------------------

/** 24h volume per match id, transcribed in `schedule.ts` (display-only). */
const VOLUME_BY_MATCH: Record<string, number> = Object.fromEntries(
  GROUP_MATCHES.map((row) => [row[0], row[6]]),
);

// Sports market type constants (Polymarket sportsMarketType values).
const SMT_MONEYLINE = "moneyline";
const SMT_SPREADS = "spreads";
const SMT_TOTALS = "totals";

// ---------------------------------------------------------------------------
// Adapter helpers
// ---------------------------------------------------------------------------

/** First finite number among the candidates, else 0. */
function num(...vals: Array<number | undefined>): number {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
}

/** Probability of an outcome (price, falling back to best ask). */
function outcomePrice(o?: WcOutcomeDto): number {
  return o ? num(o.price, o.best_ask) : 0;
}

/**
 * Price of a binary market's primary ("Yes") side. Polymarket sports markets
 * label the primary outcome with the subject (team / "Draw (...)" / "O/U 2.5")
 * rather than literally "Yes", so we fall back to the first outcome.
 */
function yesPrice(m: WcMarketDto): number {
  const outcomes = m.outcomes ?? [];
  const yes = outcomes.find((o) => o.name?.toLowerCase() === "yes");
  return outcomePrice(yes ?? outcomes[0]);
}

/**
 * Candidate identifiers for matching a market's `group_item_title` to a team.
 * The title comes from Polymarket while team metadata comes from the embed
 * store, so we accept several aliases (English name, code, abbreviation) to
 * tolerate naming drift; an order-based fallback handles any remaining misses.
 */
function teamKeys(dto: WcTeamInfoDto, team: WcTeam): Set<string> {
  return new Set(
    [dto.name, dto.team_code, dto.abbreviation, team.name, team.code]
      .filter((s): s is string => Boolean(s))
      .map((s) => s.trim().toLowerCase()),
  );
}

/** A moneyline market is the draw leg when its title leads with "draw"/"tie". */
function isDrawTitle(title: string): boolean {
  return title.startsWith("draw") || title.startsWith("tie") || title.startsWith("平");
}

function buildMoneyline(
  markets: WcMarketDto[],
  homeKeys: Set<string>,
  awayKeys: Set<string>,
  home: WcTeam,
  away: WcTeam,
): WcMoneyline {
  let homeP = 0;
  let drawP = 0;
  let awayP = 0;
  const leftover: number[] = [];

  for (const m of markets) {
    if (m.sports_market_type !== SMT_MONEYLINE) continue;
    const title = (m.group_item_title ?? "").trim().toLowerCase();
    const p = yesPrice(m);
    if (isDrawTitle(title)) drawP = p;
    else if (homeKeys.has(title)) homeP = p;
    else if (awayKeys.has(title)) awayP = p;
    else leftover.push(p);
  }

  // Assign any unmatched markets to still-empty slots in encounter order.
  for (const p of leftover) {
    if (homeP === 0) homeP = p;
    else if (awayP === 0) awayP = p;
    else if (drawP === 0) drawP = p;
  }

  return {
    home: { label: home.code, teamCode: home.code, price: homeP },
    draw: { label: "Draw", labelZh: "平", price: drawP },
    away: { label: away.code, teamCode: away.code, price: awayP },
  };
}

function buildSpread(
  markets: WcMarketDto[],
  homeKeys: Set<string>,
  awayKeys: Set<string>,
  home: WcTeam,
  away: WcTeam,
): WcSpread {
  const empty: WcSpread = {
    line: 0,
    home: { label: home.code, teamCode: home.code, price: 0 },
    away: { label: away.code, teamCode: away.code, price: 0 },
  };

  // Each spread market is the handicapped team's "-N.5" line; its two outcomes
  // already carry both sides (e.g. ["Mexico (-1.5)" 0.40, "South Africa" 0.60]
  // = the other team at +1.5). The favourite's market (higher cover price) is
  // the balanced main line; we read both sides off it.
  const spreads = markets.filter((m) => m.sports_market_type === SMT_SPREADS);
  if (spreads.length === 0) return empty;

  const fav = spreads.reduce((best, m) =>
    outcomePrice((m.outcomes ?? [])[0]) > outcomePrice((best.outcomes ?? [])[0])
      ? m
      : best,
  );
  const outs = fav.outcomes ?? [];
  const coverPrice = outcomePrice(outs[0]); // favourite covers -N.5
  const otherPrice = outcomePrice(outs[1]); // other team at +N.5
  const mag = Math.abs(num(fav.line)) || 1.5; // line magnitude, e.g. 1.5

  // outcomes[1] is the +N.5 (non-handicapped) side; whichever team it is, the
  // favourite (-N.5) is the opposite side.
  const otherName = (outs[1]?.name ?? "").trim().toLowerCase();
  const favIsHome = awayKeys.has(otherName) || !homeKeys.has(otherName);

  return favIsHome
    ? {
        line: -mag,
        home: { label: home.code, teamCode: home.code, price: coverPrice },
        away: { label: away.code, teamCode: away.code, price: otherPrice },
      }
    : {
        line: mag,
        home: { label: home.code, teamCode: home.code, price: otherPrice },
        away: { label: away.code, teamCode: away.code, price: coverPrice },
      };
}

function buildTotal(markets: WcMarketDto[]): WcTotal {
  const m = markets.find((x) => x.sports_market_type === SMT_TOTALS);
  if (!m) {
    return {
      line: 0,
      over: { label: "Over", labelZh: "大", price: 0 },
      under: { label: "Under", labelZh: "小", price: 0 },
    };
  }
  // The "under" outcome is named explicitly ("Under"); the over side is labelled
  // with the line itself ("O/U 2.5"), so it is simply the non-under outcome.
  let overP = 0;
  let underP = 0;
  for (const o of m.outcomes ?? []) {
    if ((o.name ?? "").toLowerCase().includes("under")) underP = outcomePrice(o);
    else overP = outcomePrice(o);
  }
  return {
    line: num(m.line),
    over: { label: "Over", labelZh: "大", price: overP },
    under: { label: "Under", labelZh: "小", price: underP },
  };
}

/** Map the backend status string onto the UI's three-state enum. */
function mapStatus(raw: string, kickoffMs: number): WcMatchStatus {
  switch (raw?.toLowerCase()) {
    case "live":
    case "in_progress":
      return "live";
    case "final":
    case "ended":
      return "final";
    case "scheduled":
    case "not_started":
      return "scheduled";
    default:
      // Endpoint currently only emits "scheduled"; fall back to the clock so
      // the UI can still reflect live/final windows until WS scores land.
      return raw ? "scheduled" : deriveStatus(kickoffMs);
  }
}

function adaptMatch(dto: WcMatchDto): WcMatch {
  const home = getTeam(dto.home_team.team_code);
  const away = getTeam(dto.away_team.team_code);
  const homeKeys = teamKeys(dto.home_team, home);
  const awayKeys = teamKeys(dto.away_team, away);
  const markets = dto.markets ?? [];
  const kickoffMs = Date.parse(dto.kickoff_at);

  return {
    matchId: dto.match_id,
    stage: dto.stage,
    groupCode: dto.group_code || undefined,
    kickoffMs: Number.isNaN(kickoffMs) ? 0 : kickoffMs,
    status: mapStatus(dto.status, kickoffMs),
    home,
    away,
    slug: dto.polymarket_slug,
    // Prefer the backend's aggregated figures / feed id; fall back to the
    // bundled static maps when the endpoint omits them (e.g. pre-ingestion).
    volume: dto.volume ?? VOLUME_BY_MATCH[dto.match_id] ?? 0,
    marketCount: dto.market_count,
    thesportsMatchId: dto.thesports_id || THESPORTS_MATCH_IDS[dto.match_id],
    moneyline: buildMoneyline(markets, homeKeys, awayKeys, home, away),
    spread: buildSpread(markets, homeKeys, awayKeys, home, away),
    total: buildTotal(markets),
  };
}

/** Adapt the raw matches response into the local domain shape. */
export function adaptMatches(dto: WcMatchesResponseDto): WcMatch[] {
  return (dto.matches ?? []).map(adaptMatch);
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/** Shared React Query key for the worldcup matches list. */
export const WORLDCUP_MATCHES_QUERY_KEY = ["worldcup", "matches"] as const;

/**
 * Fetch + adapt the worldcup matches list.
 *
 * `baseUrl` is the predict API base: the server passes the absolute
 * `PREDICT_URL`; the browser passes the `NEXT_PUBLIC_PREDICT_URL` rewrite
 * prefix (default `/predict-api`).
 */
export async function fetchWorldcupMatches(baseUrl: string): Promise<WcMatch[]> {
  const res = await fetch(`${baseUrl}/api/v1/worldcup/matches`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`worldcup matches request failed: ${res.status}`);
  }
  const json = (await res.json()) as WcMatchesResponseDto;
  return adaptMatches(json);
}
