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
  PredictEvent,
  PredictMarket,
  ProviderSource,
} from "@liberfi.io/react-predict";
import type {
  WcBracketNode,
  WcFeed,
  WcFeedMedia,
  WcFeedPage,
  WcGroup,
  WcMatch,
  WcLiveInfo,
  WcLiveStats,
  WcMatchLiveVideo,
  WcMatchLiveState,
  WcMatchStatus,
  WcMoneyline,
  WcOutcome,
  WcProp,
  WcSpread,
  WcStandingRow,
  WcTeam,
  WcThirdPlaceRow,
  WcTotal,
  WcMatchTradeMarkets,
} from "../types";
import { getTeam, getTeamByName } from "./teams";
import { GROUP_MATCHES, THESPORTS_MATCH_IDS } from "./schedule";
import { deriveStatus } from "../logic/match-status";

// ---------------------------------------------------------------------------
// Backend transport DTOs (snake_case, mirror internal/domain/worldcup.go)
// ---------------------------------------------------------------------------

export interface WcOutcomeDto {
  token_id?: string;
  name: string;
  /** Localized outcome name for the request language (Convention B). */
  name_trans?: string;
  price?: number;
  best_bid?: number;
  best_ask?: number;
}

export interface WcMarketDto {
  slug?: string;
  source?: ProviderSource;
  condition_id: string;
  sports_market_type: string;
  group_item_title?: string;
  /** Localized group item title for the request language (Convention B). */
  group_item_title_trans?: string;
  group_item_threshold?: string;
  line?: number;
  question: string;
  status: string;
  outcomes: WcOutcomeDto[] | null;
}

export interface WcTeamInfoDto {
  team_code: string;
  name: string;
  /** Localized team name for the request language (Convention B). */
  name_trans?: string;
  flag_url: string;
  color: string;
  abbreviation: string;
}

export interface WcMatchLiveStateDto {
  match_id: string;
  upstream_game_id?: string;
  source: string;
  league?: string;
  sport?: string;
  status: string;
  score?: { home: number; away: number };
  period?: string;
  elapsed?: string;
  live: boolean;
  ended: boolean;
  observed_at: string;
  updated_at?: string;
}

export interface WcMatchLiveVideoDto {
  url: string;
  type: number;
  status: number;
  source?: string;
}

export interface WcLiveInfoDto {
  match_id: string;
  polymarket_slug: string;
  status: string;
  overview: {
    stadium_name?: string;
    stadium_capacity?: number;
    city?: string;
    referee?: string;
    attendance?: number;
    weather_code?: string;
    weather_label?: string;
    temperature_c?: number;
    source?: string;
    source_updated_at?: string;
  };
  team_form: Array<{
    team_code: string;
    source?: string;
    matches?: Array<{
      date?: string;
      opponent_code?: string;
      home_away?: string;
      result?: string;
      score?: string;
      competition?: string;
    }> | null;
    source_updated_at?: string;
    observed_after_match?: boolean;
  }> | null;
  head_to_head: {
    total: number;
    home_wins: number;
    away_wins: number;
    draws: number;
    source?: string;
    matches?: Array<{
      date?: string;
      home_code?: string;
      away_code?: string;
      home_score?: number;
      away_score?: number;
      competition?: string;
    }> | null;
    source_updated_at?: string;
  };
  squads: Array<{
    team_code: string;
    formation?: string;
    core_players?: WcPlayerSummaryDto[] | null;
    starters?: WcPlayerSummaryDto[] | null;
    substitutes?: WcPlayerSummaryDto[] | null;
    injuries?: Array<{
      player_id?: string;
      name: string;
      status?: string;
      detail?: string;
    }> | null;
    source?: string;
    source_updated_at?: string;
    observed_after_match?: boolean;
  }> | null;
  live_stats?: WcLiveStatsDto;
  data_quality: {
    sources: string[] | null;
    missing_fields?: string[] | null;
    partial?: boolean;
    finalized?: boolean;
    finalized_at?: string;
    updated_at?: string;
  };
}

export interface WcPlayerSummaryDto {
  player_id?: string;
  name: string;
  position?: string;
  number?: number;
  team_code?: string;
  score?: number;
  role?: string;
}

export interface WcTeamStatLineDto {
  team_code: string;
  possession_pct?: number;
  shots_total?: number;
  shots_on_target?: number;
  corners?: number;
  offsides?: number;
  fouls?: number;
  yellow_cards?: number;
  red_cards?: number;
  passes_total?: number;
  passes_accurate?: number;
  saves?: number;
  tackles?: number;
  interceptions?: number;
  clearances?: number;
}

export interface WcLiveStatsDto {
  match_id: string;
  source: string;
  stats: WcTeamStatLineDto[] | null;
  observed_at: string;
  source_updated_at?: string;
}

export interface WorldcupMatchStatsUpdate {
  type: "worldcup.match.stats_update";
  version: number;
  match_id: string;
  event_slug: string;
  stats: WcLiveStatsDto;
  ts_ms?: number;
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
  /** Localized match title for the request language (Convention B). */
  title_trans?: string;
  /** TheSports feed id (static config); omitted for undrawn knockout fixtures. */
  thesports_id?: string;
  /** Aggregated USD figures; omitted (not 0) when markets are not yet ingested. */
  volume?: number;
  volume_24h?: number;
  liquidity?: number;
  markets: WcMarketDto[] | null;
  market_count: number;
  /** Lightweight PredictEvent shell plus the card trade markets. */
  trade_event?: PredictEvent;
  /** Full SDK market objects for the odds buttons shown by the card. */
  trade_markets?: WcMatchTradeMarkets;
  live_state?: WcMatchLiveStateDto;
  live_videos?: WcMatchLiveVideoDto[] | null;
}

export interface WcMatchesResponseDto {
  matches: WcMatchDto[] | null;
}

export interface WorldcupMatchLiveUpdate {
  type: "worldcup.match.live_update";
  version: number;
  match_id: string;
  event_slug: string;
  state: WcMatchLiveStateDto;
}

export interface WcOutcomePatchDto {
  token_id?: string;
  best_bid?: number;
  best_ask?: number;
}

export interface WcMarketPatchDto {
  slug: string;
  outcomes: WcOutcomePatchDto[] | null;
  observed_at?: number;
}

export interface WorldcupMatchMarketUpdate {
  type: "match_market_update";
  match_id: string;
  event_slug: string;
  markets: WcMarketPatchDto[] | null;
  ts_ms?: number;
}

export type WorldcupMarketRealtimeMeta = Record<string, number>;

export interface WorldcupMarketRealtimeState {
  updates: Record<string, WorldcupMatchMarketUpdate>;
}

export const EMPTY_WORLDCUP_MARKET_REALTIME: WorldcupMarketRealtimeState = {
  updates: {},
};

export type PredictEventWithWorldcupLive = PredictEvent & {
  live_state?: WcMatchLiveStateDto;
  live_videos?: WcMatchLiveVideoDto[] | null;
};

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

/** Displayed buy price for an outcome, falling back to the mark price. */
function outcomePrice(o?: WcOutcomeDto): number {
  return o ? num(o.best_ask, o.price) : 0;
}

function outcomeBase(
  label: string,
  outcome?: WcOutcomeDto,
  market?: WcMarketDto,
  extra: Partial<WcOutcome> = {},
): WcOutcome {
  return {
    label,
    labelTrans: outcome?.name_trans,
    price: outcomePrice(outcome),
    tokenId: outcome?.token_id,
    marketSlug: market?.slug,
    marketSource: market?.source ?? "polymarket",
    bestBid: outcome?.best_bid,
    bestAsk: outcome?.best_ask,
    ...extra,
  };
}

/**
 * Price of a binary market's primary ("Yes") side. Polymarket sports markets
 * label the primary outcome with the subject (team / "Draw (...)" / "O/U 2.5")
 * rather than literally "Yes", so we fall back to the first outcome.
 */
function primaryOutcome(m: WcMarketDto): WcOutcomeDto | undefined {
  const outcomes = m.outcomes ?? [];
  return outcomes.find((o) => o.name?.toLowerCase() === "yes") ?? outcomes[0];
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
  let homeO: { market: WcMarketDto; outcome: WcOutcomeDto } | undefined;
  let drawO: { market: WcMarketDto; outcome: WcOutcomeDto } | undefined;
  let awayO: { market: WcMarketDto; outcome: WcOutcomeDto } | undefined;
  const leftover: { market: WcMarketDto; outcome: WcOutcomeDto }[] = [];

  for (const m of markets) {
    if (m.sports_market_type !== SMT_MONEYLINE) continue;
    const title = (m.group_item_title ?? "").trim().toLowerCase();
    const outcome = primaryOutcome(m);
    if (!outcome) continue;
    const entry = { market: m, outcome };
    if (isDrawTitle(title)) drawO = entry;
    else if (homeKeys.has(title)) homeO = entry;
    else if (awayKeys.has(title)) awayO = entry;
    else leftover.push(entry);
  }

  // Assign any unmatched markets to still-empty slots in encounter order.
  for (const entry of leftover) {
    if (!homeO) homeO = entry;
    else if (!awayO) awayO = entry;
    else if (!drawO) drawO = entry;
  }

  return {
    home: outcomeBase(home.code, homeO?.outcome, homeO?.market, { teamCode: home.code }),
    draw: outcomeBase("Draw", drawO?.outcome, drawO?.market),
    away: outcomeBase(away.code, awayO?.outcome, awayO?.market, { teamCode: away.code }),
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
  const cover = outs[0]; // favourite covers -N.5
  const other = outs[1]; // other team at +N.5
  const mag = Math.abs(num(fav.line)) || 1.5; // line magnitude, e.g. 1.5

  // outcomes[1] is the +N.5 (non-handicapped) side; whichever team it is, the
  // favourite (-N.5) is the opposite side.
  const otherName = (outs[1]?.name ?? "").trim().toLowerCase();
  const favIsHome = awayKeys.has(otherName) || !homeKeys.has(otherName);

  return favIsHome
    ? {
        line: -mag,
        home: outcomeBase(home.code, cover, fav, { teamCode: home.code }),
        away: outcomeBase(away.code, other, fav, { teamCode: away.code }),
      }
    : {
        line: mag,
        home: outcomeBase(home.code, other, fav, { teamCode: home.code }),
        away: outcomeBase(away.code, cover, fav, { teamCode: away.code }),
      };
}

function buildTotal(markets: WcMarketDto[]): WcTotal {
  const m = markets.find((x) => x.sports_market_type === SMT_TOTALS);
  if (!m) {
    return {
      line: 0,
      over: { label: "Over", price: 0 },
      under: { label: "Under", price: 0 },
    };
  }
  // The "under" outcome is named explicitly ("Under"); the over side is labelled
  // with the line itself ("O/U 2.5"), so it is simply the non-under outcome.
  let over: WcOutcomeDto | undefined;
  let under: WcOutcomeDto | undefined;
  for (const o of m.outcomes ?? []) {
    if ((o.name ?? "").toLowerCase().includes("under")) under = o;
    else over = o;
  }
  return {
    line: num(m.line),
    over: outcomeBase("Over", over, m),
    under: outcomeBase("Under", under, m),
  };
}

function tradeMarketsList(tradeMarkets?: WcMatchTradeMarkets): PredictMarket[] {
  if (!tradeMarkets) return [];
  const seen = new Set<string>();
  const markets: PredictMarket[] = [];
  for (const market of Object.values(tradeMarkets)) {
    if (!market || seen.has(market.slug)) continue;
    seen.add(market.slug);
    markets.push(market);
  }
  return markets;
}

function buildTradeEvent(
  dto: WcMatchDto,
  tradeMarkets?: WcMatchTradeMarkets,
): PredictEvent | undefined {
  if (!dto.trade_event) return undefined;
  const markets = dto.trade_event.markets?.length
    ? dto.trade_event.markets
    : tradeMarketsList(tradeMarkets);
  return { ...dto.trade_event, markets };
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

export function adaptLiveState(dto?: WcMatchLiveStateDto): WcMatchLiveState | undefined {
  if (!dto) return undefined;
  return {
    matchId: dto.match_id,
    upstreamGameId: dto.upstream_game_id,
    source: dto.source,
    league: dto.league,
    sport: dto.sport,
    status: mapStatus(dto.status, 0),
    score: dto.score,
    period: dto.period,
    elapsed: dto.elapsed,
    live: dto.live,
    ended: dto.ended,
    observedAt: dto.observed_at,
    updatedAt: dto.updated_at,
  };
}

export function adaptLiveVideos(videos?: WcMatchLiveVideoDto[] | null): WcMatchLiveVideo[] {
  return (videos ?? [])
    .filter((video) => video.url && video.status === 1)
    .map((video) => ({
      url: video.url,
      type: video.type,
      status: video.status,
      source: video.source || undefined,
    }));
}

export function adaptLiveStats(dto?: WcLiveStatsDto): WcLiveStats | undefined {
  if (!dto) return undefined;
  return {
    matchId: dto.match_id,
    source: dto.source,
    observedAt: dto.observed_at,
    sourceUpdatedAt: dto.source_updated_at,
    stats: (dto.stats ?? []).map((line) => ({
      teamCode: line.team_code,
      possessionPct: line.possession_pct,
      shotsTotal: line.shots_total,
      shotsOnTarget: line.shots_on_target,
      corners: line.corners,
      offsides: line.offsides,
      fouls: line.fouls,
      yellowCards: line.yellow_cards,
      redCards: line.red_cards,
      passesTotal: line.passes_total,
      passesAccurate: line.passes_accurate,
      saves: line.saves,
      tackles: line.tackles,
      interceptions: line.interceptions,
      clearances: line.clearances,
    })),
  };
}

function adaptPlayer(dto: WcPlayerSummaryDto) {
  return {
    playerId: dto.player_id,
    name: dto.name,
    position: dto.position,
    number: dto.number,
    teamCode: dto.team_code,
    score: dto.score,
    role: dto.role,
  };
}

export function adaptLiveInfo(dto: WcLiveInfoDto): WcLiveInfo {
  return {
    matchId: dto.match_id,
    polymarketSlug: dto.polymarket_slug,
    status: dto.status,
    overview: {
      stadiumName: dto.overview?.stadium_name,
      stadiumCapacity: dto.overview?.stadium_capacity,
      city: dto.overview?.city,
      referee: dto.overview?.referee,
      attendance: dto.overview?.attendance,
      weatherCode: dto.overview?.weather_code,
      weatherLabel: dto.overview?.weather_label,
      temperatureC: dto.overview?.temperature_c,
      source: dto.overview?.source,
      sourceUpdatedAt: dto.overview?.source_updated_at,
    },
    teamForm: (dto.team_form ?? []).map((form) => ({
      teamCode: form.team_code,
      source: form.source,
      sourceUpdatedAt: form.source_updated_at,
      observedAfterMatch: form.observed_after_match,
      matches: (form.matches ?? []).map((match) => ({
        date: match.date,
        opponentCode: match.opponent_code,
        homeAway: match.home_away,
        result: match.result,
        score: match.score,
        competition: match.competition,
      })),
    })),
    headToHead: {
      total: dto.head_to_head?.total ?? 0,
      homeWins: dto.head_to_head?.home_wins ?? 0,
      awayWins: dto.head_to_head?.away_wins ?? 0,
      draws: dto.head_to_head?.draws ?? 0,
      source: dto.head_to_head?.source,
      sourceUpdatedAt: dto.head_to_head?.source_updated_at,
      matches: (dto.head_to_head?.matches ?? []).map((match) => ({
        date: match.date,
        homeCode: match.home_code,
        awayCode: match.away_code,
        homeScore: match.home_score,
        awayScore: match.away_score,
        competition: match.competition,
      })),
    },
    squads: (dto.squads ?? []).map((squad) => ({
      teamCode: squad.team_code,
      formation: squad.formation,
      corePlayers: (squad.core_players ?? []).map(adaptPlayer),
      starters: (squad.starters ?? []).map(adaptPlayer),
      substitutes: (squad.substitutes ?? []).map(adaptPlayer),
      injuries: (squad.injuries ?? []).map((injury) => ({
        playerId: injury.player_id,
        name: injury.name,
        status: injury.status,
        detail: injury.detail,
      })),
      source: squad.source,
      sourceUpdatedAt: squad.source_updated_at,
      observedAfterMatch: squad.observed_after_match,
    })),
    liveStats: adaptLiveStats(dto.live_stats),
    dataQuality: {
      sources: dto.data_quality?.sources ?? [],
      missingFields: dto.data_quality?.missing_fields ?? undefined,
      partial: dto.data_quality?.partial,
      finalized: dto.data_quality?.finalized,
      finalizedAt: dto.data_quality?.finalized_at,
      updatedAt: dto.data_quality?.updated_at,
    },
  };
}

export function formatLivePeriod(state?: WcMatchLiveState): string | undefined {
  if (!state) return undefined;
  if (state.period && state.elapsed) return `${state.period} · ${state.elapsed}'`;
  return state.period || (state.live ? "LIVE" : undefined);
}

export function applyLiveStateToMatch(match: WcMatch, state: WcMatchLiveState): WcMatch {
  if (state.matchId !== match.matchId) return match;
  if (match.liveState?.updatedAt && state.updatedAt) {
    const current = Date.parse(match.liveState.updatedAt);
    const incoming = Date.parse(state.updatedAt);
    if (!Number.isNaN(current) && !Number.isNaN(incoming) && incoming < current) {
      return match;
    }
  }
  return {
    ...match,
    status: state.status,
    liveScore: state.score,
    livePeriod: formatLivePeriod(state),
    liveState: state,
    liveVideos: match.liveVideos,
  };
}

type PredictOutcome = PredictMarket["outcomes"][number];
type PredictOutcomeWithToken = PredictOutcome & {
  token_id?: string;
  tokenId?: string;
};

const TRADE_MARKET_KEYS: Array<keyof WcMatchTradeMarkets> = [
  "moneylineHome",
  "moneylineDraw",
  "moneylineAway",
  "spreadHome",
  "spreadAway",
  "spread",
  "total",
];

function outcomeTokenID(outcome: PredictOutcome): string | undefined {
  const withToken = outcome as PredictOutcomeWithToken;
  return withToken.token_id ?? withToken.tokenId;
}

function patchForOutcome(
  outcome: PredictOutcome,
  patches: WcOutcomePatchDto[],
  index: number,
): WcOutcomePatchDto | undefined {
  const tokenID = outcomeTokenID(outcome);
  if (tokenID) {
    const byToken = patches.find((patch) => patch.token_id === tokenID);
    if (byToken) return byToken;
  }
  return patches[index];
}

function patchPredictMarket(
  market: PredictMarket,
  patch: WcMarketPatchDto,
): { market: PredictMarket; changed: boolean; matched: boolean } {
  if (market.slug !== patch.slug) {
    return { market, changed: false, matched: false };
  }

  const outcomePatches = patch.outcomes ?? [];
  if (outcomePatches.length === 0 || market.outcomes.length === 0) {
    return { market, changed: false, matched: true };
  }

  let changed = false;
  const outcomes = market.outcomes.map((outcome, index) => {
    const outcomePatch = patchForOutcome(outcome, outcomePatches, index);
    if (!outcomePatch) return outcome;

    const nextBid = outcomePatch.best_bid ?? outcome.best_bid;
    const nextAsk = outcomePatch.best_ask ?? outcome.best_ask;
    if (nextBid === outcome.best_bid && nextAsk === outcome.best_ask) {
      return outcome;
    }

    changed = true;
    return {
      ...outcome,
      best_bid: nextBid,
      best_ask: nextAsk,
    };
  });

  return {
    market: changed ? { ...market, outcomes } : market,
    changed,
    matched: true,
  };
}

function patchTradeMarkets(
  tradeMarkets: WcMatchTradeMarkets | undefined,
  patches: WcMarketPatchDto[],
): { tradeMarkets?: WcMatchTradeMarkets; changed: boolean; matched: boolean } {
  if (!tradeMarkets) {
    return { tradeMarkets, changed: false, matched: false };
  }

  let changed = false;
  let matched = false;
  let next = tradeMarkets;

  for (const key of TRADE_MARKET_KEYS) {
    const market = tradeMarkets[key];
    if (!market) continue;
    const patch = patches.find((candidate) => candidate.slug === market.slug);
    if (!patch) continue;

    const result = patchPredictMarket(market, patch);
    matched = matched || result.matched;
    if (!result.changed) continue;

    if (next === tradeMarkets) next = { ...tradeMarkets };
    next[key] = result.market;
    changed = true;
  }

  return { tradeMarkets: next, changed, matched };
}

function patchTradeEvent(
  event: PredictEvent | undefined,
  patches: WcMarketPatchDto[],
): { event?: PredictEvent; changed: boolean; matched: boolean } {
  const markets = event?.markets;
  if (!event || !markets?.length) {
    return { event, changed: false, matched: false };
  }

  let changed = false;
  let matched = false;
  const nextMarkets = markets.map((market) => {
    const patch = patches.find((candidate) => candidate.slug === market.slug);
    if (!patch) return market;

    const result = patchPredictMarket(market, patch);
    matched = matched || result.matched;
    changed = changed || result.changed;
    return result.market;
  });

  return {
    event: changed ? { ...event, markets: nextMarkets } : event,
    changed,
    matched,
  };
}

/** Best-bid/ask patch for one provider token, with its observation time. */
interface OutcomeTokenPatch {
  bestBid?: number;
  bestAsk?: number;
  observedAt: number;
}

/**
 * Index a market update's outcome patches by provider `token_id`. The card's
 * odds outcomes (moneyline/spread/total) each carry the same `tokenId` from the
 * inline `markets[]`, so a live patch can be applied directly by token without
 * needing the heavy `tradeMarkets` objects in the list payload.
 */
function collectOutcomeTokenPatches(
  update: WorldcupMatchMarketUpdate,
  patches: WcMarketPatchDto[],
): Map<string, OutcomeTokenPatch> {
  const byToken = new Map<string, OutcomeTokenPatch>();
  for (const patch of patches) {
    const observedAt = patchObservedAt(update, patch);
    for (const outcome of patch.outcomes ?? []) {
      if (!outcome.token_id) continue;
      const prev = byToken.get(outcome.token_id);
      if (prev && prev.observedAt > observedAt) continue;
      byToken.set(outcome.token_id, {
        bestBid: outcome.best_bid,
        bestAsk: outcome.best_ask,
        observedAt,
      });
    }
  }
  return byToken;
}

/** Apply a token-keyed patch to a single card outcome. */
function patchOutcomeByToken(
  outcome: WcOutcome,
  byToken: Map<string, OutcomeTokenPatch>,
): { outcome: WcOutcome; changed: boolean } {
  if (!outcome.tokenId) return { outcome, changed: false };
  const patch = byToken.get(outcome.tokenId);
  if (!patch) return { outcome, changed: false };

  const nextBid = patch.bestBid ?? outcome.bestBid;
  const nextAsk = patch.bestAsk ?? outcome.bestAsk;
  // Realtime prefers the best ask for the displayed price (mirrors the old
  // trade-market refresh); falls back to the current price when ask is absent.
  const nextPrice = num(patch.bestAsk, outcome.price);
  if (
    nextBid === outcome.bestBid &&
    nextAsk === outcome.bestAsk &&
    nextPrice === outcome.price
  ) {
    return { outcome, changed: false };
  }
  return {
    outcome: {
      ...outcome,
      bestBid: nextBid,
      bestAsk: nextAsk,
      price: nextPrice,
      marketObservedAt: patch.observedAt,
    },
    changed: true,
  };
}

/**
 * Refresh the card's moneyline/spread/total odds straight from a market
 * update's per-token best bid/ask. Independent of `tradeMarkets`, so it keeps
 * working after the list payload drops the heavy trade objects.
 */
function applyOddsPatchByToken(
  match: WcMatch,
  byToken: Map<string, OutcomeTokenPatch>,
): { match: WcMatch; changed: boolean } {
  if (byToken.size === 0) return { match, changed: false };

  const mlHome = patchOutcomeByToken(match.moneyline.home, byToken);
  const mlDraw = patchOutcomeByToken(match.moneyline.draw, byToken);
  const mlAway = patchOutcomeByToken(match.moneyline.away, byToken);
  const spHome = patchOutcomeByToken(match.spread.home, byToken);
  const spAway = patchOutcomeByToken(match.spread.away, byToken);
  const toOver = patchOutcomeByToken(match.total.over, byToken);
  const toUnder = patchOutcomeByToken(match.total.under, byToken);

  const changed =
    mlHome.changed ||
    mlDraw.changed ||
    mlAway.changed ||
    spHome.changed ||
    spAway.changed ||
    toOver.changed ||
    toUnder.changed;
  if (!changed) return { match, changed: false };

  return {
    changed: true,
    match: {
      ...match,
      moneyline: {
        home: mlHome.outcome,
        draw: mlDraw.outcome,
        away: mlAway.outcome,
      },
      spread: {
        ...match.spread,
        home: spHome.outcome,
        away: spAway.outcome,
      },
      total: {
        ...match.total,
        over: toOver.outcome,
        under: toUnder.outcome,
      },
    },
  };
}

function patchObservedAt(
  update: WorldcupMatchMarketUpdate,
  patch: WcMarketPatchDto,
): number {
  return patch.observed_at ?? update.ts_ms ?? Date.now();
}

export function applyMarketUpdateToMatches(
  matches: WcMatch[],
  update: WorldcupMatchMarketUpdate,
  meta: WorldcupMarketRealtimeMeta,
): { matches: WcMatch[]; meta: WorldcupMarketRealtimeMeta } {
  const patches = update.markets ?? [];
  if (patches.length === 0) return { matches, meta };

  let nextMeta = meta;
  let changedAnyMatch = false;

  const nextMatches = matches.map((match) => {
    if (match.matchId !== update.match_id) return match;

    const eligiblePatches = patches.filter((patch) => {
      if (!patch.slug) return false;
      const key = `${match.matchId}:${patch.slug}`;
      const currentObservedAt = meta[key];
      const incomingObservedAt = patchObservedAt(update, patch);
      return !currentObservedAt || incomingObservedAt >= currentObservedAt;
    });
    if (eligiblePatches.length === 0) return match;

    // Primary path: patch the displayed odds directly by provider token. Works
    // whether or not the (heavy) tradeMarkets/tradeEvent objects are present.
    const byToken = collectOutcomeTokenPatches(update, eligiblePatches);
    const oddsResult = applyOddsPatchByToken(match, byToken);

    // Keep the trade fast-path objects fresh while the list still carries them
    // (older backend); both no-op once the list drops trade_event/trade_markets.
    const tradeMarketsResult = patchTradeMarkets(match.tradeMarkets, eligiblePatches);
    const tradeEventResult = patchTradeEvent(match.tradeEvent, eligiblePatches);

    const matched =
      oddsResult.changed ||
      tradeMarketsResult.matched ||
      tradeEventResult.matched;
    if (!matched) return match;

    for (const patch of eligiblePatches) {
      const observedAt = patchObservedAt(update, patch);
      const key = `${match.matchId}:${patch.slug}`;
      if (nextMeta === meta) nextMeta = { ...meta };
      nextMeta[key] = observedAt;
    }

    if (
      !oddsResult.changed &&
      !tradeMarketsResult.changed &&
      !tradeEventResult.changed
    ) {
      return match;
    }

    changedAnyMatch = true;
    return {
      ...oddsResult.match,
      tradeMarkets: tradeMarketsResult.tradeMarkets,
      tradeEvent: tradeEventResult.event,
    };
  });

  return {
    matches: changedAnyMatch ? nextMatches : matches,
    meta: nextMeta,
  };
}

function realtimePatchObservedAt(
  update: WorldcupMatchMarketUpdate,
  patch: WcMarketPatchDto,
): number {
  return patch.observed_at ?? update.ts_ms ?? 0;
}

export function mergeMarketRealtimeState(
  current: WorldcupMarketRealtimeState,
  update: WorldcupMatchMarketUpdate,
): WorldcupMarketRealtimeState {
  const incomingPatches = update.markets ?? [];
  if (!update.match_id || incomingPatches.length === 0) return current;

  const existing = current.updates[update.match_id];
  const bySlug = new Map<string, WcMarketPatchDto>();
  for (const patch of existing?.markets ?? []) {
    if (patch.slug) bySlug.set(patch.slug, patch);
  }

  let changed = false;
  for (const patch of incomingPatches) {
    if (!patch.slug) continue;
    const previous = bySlug.get(patch.slug);
    const incomingAt = realtimePatchObservedAt(update, patch);
    const previousAt = previous
      ? realtimePatchObservedAt(existing ?? update, previous)
      : 0;
    if (!previous || incomingAt >= previousAt) {
      bySlug.set(patch.slug, patch);
      changed = true;
    }
  }
  if (!changed) return current;

  return {
    updates: {
      ...current.updates,
      [update.match_id]: {
        ...update,
        markets: [...bySlug.values()],
      },
    },
  };
}

export function applyMarketRealtimeToMatches(
  matches: WcMatch[],
  state: WorldcupMarketRealtimeState,
): WcMatch[] {
  let next = matches;
  for (const update of Object.values(state.updates)) {
    next = applyMarketUpdateToMatches(next, update, {}).matches;
  }
  return next;
}

function adaptMatch(dto: WcMatchDto): WcMatch {
  const home = getTeam(dto.home_team.team_code);
  const away = getTeam(dto.away_team.team_code);
  const homeKeys = teamKeys(dto.home_team, home);
  const awayKeys = teamKeys(dto.away_team, away);
  const markets = dto.markets ?? [];
  const tradeMarkets = dto.trade_markets;
  const kickoffMs = Date.parse(dto.kickoff_at);
  const liveState = adaptLiveState(dto.live_state);

  const match: WcMatch = {
    matchId: dto.match_id,
    stage: dto.stage,
    groupCode: dto.group_code || undefined,
    kickoffMs: Number.isNaN(kickoffMs) ? 0 : kickoffMs,
    status: liveState?.status ?? mapStatus(dto.status, kickoffMs),
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
    tradeEvent: buildTradeEvent(dto, tradeMarkets),
    tradeMarkets,
    liveScore: liveState?.score,
    livePeriod: formatLivePeriod(liveState),
    liveState,
    liveVideos: adaptLiveVideos(dto.live_videos),
  };
  return match;
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
export async function fetchWorldcupMatches(
  baseUrl: string,
  lang?: string,
): Promise<WcMatch[]> {
  return getWorldcupJson<WcMatchesResponseDto>(baseUrl, "matches", lang).then(
    adaptMatches,
  );
}

// ---------------------------------------------------------------------------
// Single match detail (full aggregated event)
// ---------------------------------------------------------------------------

/**
 * Shared React Query key for a single match's full aggregated event. Distinct
 * from the SDK's `eventQueryKey` so it never collides with the generic event
 * detail cache (which only holds the 3 base-slug moneyline markets).
 */
export const worldcupMatchEventQueryKey = (slug: string) =>
  ["worldcup", "match-event", slug] as const;

export const worldcupMatchLiveInfoQueryKey = (matchId: string) =>
  ["worldcup", "match-live-info", matchId] as const;

/**
 * Fetch a single World Cup match as a full {@link PredictEvent} with every
 * core and extended market. Hits `GET /api/v1/worldcup/matches/{slug}` with
 * `include_extended=true`; the response is already the snake_case PredictEvent
 * shape, so SDK leaf components consume it directly.
 */
export async function fetchWorldcupMatchEvent(
  baseUrl: string,
  slug: string,
  lang?: string,
): Promise<PredictEventWithWorldcupLive> {
  return getWorldcupJson<PredictEventWithWorldcupLive>(
    baseUrl,
    `matches/${encodeURIComponent(slug)}?include_extended=true`,
    lang,
  );
}

export async function fetchWorldcupMatchLiveInfo(
  baseUrl: string,
  matchId: string,
  lang?: string,
): Promise<WcLiveInfo> {
  return getWorldcupJson<WcLiveInfoDto>(
    baseUrl,
    `matches/${encodeURIComponent(matchId)}/live-info`,
    lang,
  ).then(adaptLiveInfo);
}

/**
 * GET + parse a worldcup BFF endpoint. Shared by all worldcup fetchers.
 *
 * `lang` is the authoritative backend `?lang=` signal (06-i18n.md §"语言传递"):
 * it is appended to the URL so SSR (direct PREDICT_URL) and the browser
 * (`/predict-api` rewrite) behave identically and HTTP/CDN caching keys by
 * language. Omitted/`en` requests send no param (English base).
 */
async function getWorldcupJson<T>(
  baseUrl: string,
  path: string,
  lang?: string,
): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const suffix = lang && lang !== "en" ? `${sep}lang=${encodeURIComponent(lang)}` : "";
  const res = await fetch(`${baseUrl}/api/v1/worldcup/${path}${suffix}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`worldcup ${path} request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Market news (social / Twitter feeds)
// ---------------------------------------------------------------------------
//
// Backed by `GET /api/v1/events/{slug}/feeds` (cursor-paginated). The endpoint
// currently proxies a global feed, so the slug is forwarded but not yet used to
// filter; the data layer stays event-scoped for forward compatibility.

interface WcFeedUserDto {
  id?: string;
  handle?: string;
  name?: string;
  avatar?: string;
  verified_type?: string;
}

interface WcFeedDto {
  id: string;
  tweet_id?: string;
  origin_tweet_id?: string;
  type: string;
  text?: string;
  created_at: string; // RFC3339
  user: WcFeedUserDto;
  photos?: string[] | null;
  videos?: string[] | null;
  thumbnails?: string[] | null;
  categories?: string[] | null;
  significance?: number;
  platform?: number;
  source?: string;
}

interface WcFeedsResponseDto {
  items: WcFeedDto[] | null;
  next_cursor?: string;
  has_more?: boolean;
  limit?: number;
}

export const worldcupFeedsQueryKey = (slug: string) =>
  ["worldcup", "feeds", slug] as const;

/** Flatten upstream video/photo arrays into an ordered media list. */
function adaptFeedMedia(dto: WcFeedDto): WcFeedMedia[] {
  const medias: WcFeedMedia[] = [];
  const thumbnails = dto.thumbnails ?? [];
  (dto.videos ?? []).forEach((url, i) => {
    medias.push({ type: "video", url, thumbnail: thumbnails[i] });
  });
  (dto.photos ?? []).forEach((url) => {
    medias.push({ type: "image", url });
  });
  return medias;
}

/** Adapt the snake_case backend feed DTO into the local {@link WcFeed} shape. */
export function adaptFeed(dto: WcFeedDto): WcFeed {
  return {
    id: dto.id,
    tweetId: dto.tweet_id,
    originTweetId: dto.origin_tweet_id,
    type: dto.type,
    text: dto.text,
    timestampMs: Date.parse(dto.created_at) || 0,
    user: {
      id: dto.user?.id,
      handle: dto.user?.handle,
      name: dto.user?.name,
      avatar: dto.user?.avatar,
      verifiedType: dto.user?.verified_type,
    },
    medias: adaptFeedMedia(dto),
    categories: dto.categories ?? [],
    significance: dto.significance,
    source: dto.source,
  };
}

/**
 * Fetch a page of market-news feeds for a match (event) slug. Cursor is the
 * opaque token returned by the previous page.
 */
export async function fetchWorldcupFeeds(
  baseUrl: string,
  slug: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<WcFeedPage> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  const res = await fetch(
    `${baseUrl}/api/v1/events/${encodeURIComponent(slug)}/feeds${qs ? `?${qs}` : ""}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`worldcup feeds request failed: ${res.status}`);
  }
  const dto = (await res.json()) as WcFeedsResponseDto;
  return {
    items: (dto.items ?? []).map(adaptFeed),
    nextCursor: dto.next_cursor,
    hasMore: Boolean(dto.has_more),
  };
}

// ---------------------------------------------------------------------------
// Standings + best-third (Groups tab)
// ---------------------------------------------------------------------------

export interface WcStandingRowDto {
  team_code: string;
  name: string;
  flag_url: string;
  color: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  form: Array<string | null> | null;
  rank: number;
  advance_probability?: number;
}

export interface WcStandingGroupDto {
  group_code: string;
  group_label: string;
  teams: WcStandingRowDto[];
}

export interface WcStandingsResponseDto {
  groups: WcStandingGroupDto[] | null;
}

export interface WcBestThirdRowDto extends WcStandingRowDto {
  from_group: string;
}

export interface WcBestThirdResponseDto {
  is_provisional: boolean;
  teams: WcBestThirdRowDto[] | null;
}

/** Number of best third-placed teams that advance to the Round of 32. */
const THIRD_PLACE_QUALIFY = 8;

/** Coerce the backend form (nullable strings) to the W/D/L union. */
function adaptForm(form: Array<string | null> | null): WcStandingRow["form"] {
  return (form ?? []).map((f) => {
    const u = (f ?? "").toUpperCase();
    return u === "W" || u === "D" || u === "L" ? u : null;
  });
}

function adaptStandingRow(dto: WcStandingRowDto): WcStandingRow {
  return {
    rank: dto.rank,
    team: getTeam(dto.team_code),
    p: dto.p,
    w: dto.w,
    d: dto.d,
    l: dto.l,
    gf: dto.gf,
    ga: dto.ga,
    gd: dto.gd,
    pts: dto.pts,
    form: adaptForm(dto.form),
    advance: dto.advance_probability,
  };
}

/** Adapt the standings response into the local group tables. */
export function adaptStandings(dto: WcStandingsResponseDto): WcGroup[] {
  return (dto.groups ?? []).map((g) => ({
    code: g.group_code,
    label: g.group_label,
    teams: (g.teams ?? []).map(adaptStandingRow),
  }));
}

/** Adapt the best-third response; `qualifies` is derived from the rank. */
export function adaptBestThird(dto: WcBestThirdResponseDto): WcThirdPlaceRow[] {
  return (dto.teams ?? []).map((t) => ({
    rank: t.rank,
    group: t.from_group,
    team: getTeam(t.team_code),
    advance: t.advance_probability,
    qualifies: t.rank <= THIRD_PLACE_QUALIFY,
  }));
}

export const WORLDCUP_STANDINGS_QUERY_KEY = ["worldcup", "standings"] as const;
export const WORLDCUP_BEST_THIRD_QUERY_KEY = [
  "worldcup",
  "best-third",
] as const;

export async function fetchWorldcupStandings(
  baseUrl: string,
  lang?: string,
): Promise<WcGroup[]> {
  return getWorldcupJson<WcStandingsResponseDto>(
    baseUrl,
    "standings",
    lang,
  ).then(adaptStandings);
}

export async function fetchWorldcupBestThird(
  baseUrl: string,
  lang?: string,
): Promise<WcThirdPlaceRow[]> {
  return getWorldcupJson<WcBestThirdResponseDto>(
    baseUrl,
    "best-third",
    lang,
  ).then(adaptBestThird);
}

// ---------------------------------------------------------------------------
// Bracket (knockout tab)
// ---------------------------------------------------------------------------

export interface WcBracketMatchDto {
  match_id: string;
  stage: string;
  group_code?: string;
  status: string;
  kickoff_at: string;
  home_team?: WcTeamInfoDto | null;
  away_team?: WcTeamInfoDto | null;
  polymarket_slug?: string;
  title?: string;
  markets?: WcMarketDto[] | null;
  market_count?: number;
  home_placeholder?: string;
  away_placeholder?: string;
  venue?: string;
  city?: string;
  live_state?: WcMatchLiveStateDto;
}

export interface WcBracketResponseDto {
  matches: WcBracketMatchDto[] | null;
}

/**
 * Adapt the bracket response into knockout nodes. The endpoint returns all 104
 * matches (72 group-stage + 32 knockout); the bracket view only renders the
 * knockout rounds, so the group-stage matches are filtered out.
 */
export function adaptBracket(dto: WcBracketResponseDto): WcBracketNode[] {
  return (dto.matches ?? [])
    .filter((m) => !m.stage.startsWith("group"))
    .map((m) => {
      const kickoffMs = Date.parse(m.kickoff_at);
      return {
        matchId: m.match_id,
        round: m.stage,
        homeLabel: m.home_placeholder ?? "",
        awayLabel: m.away_placeholder ?? "",
        homeTeam: m.home_team ? getTeam(m.home_team.team_code) : undefined,
        awayTeam: m.away_team ? getTeam(m.away_team.team_code) : undefined,
        venue: m.venue ?? "",
        city: m.city ?? "",
        kickoffMs: Number.isNaN(kickoffMs) ? 0 : kickoffMs,
      };
    });
}

export const WORLDCUP_BRACKET_QUERY_KEY = ["worldcup", "bracket"] as const;

export async function fetchWorldcupBracket(
  baseUrl: string,
  lang?: string,
): Promise<WcBracketNode[]> {
  return getWorldcupJson<WcBracketResponseDto>(baseUrl, "bracket", lang).then(
    adaptBracket,
  );
}

// ---------------------------------------------------------------------------
// Props (tournament-wide prop / futures events)
// ---------------------------------------------------------------------------

export interface WcPropEventDto {
  slug: string;
  /** English base title (Convention B). */
  title: string;
  /** Localized title for the request language (Convention B). */
  title_trans?: string;
  display_order: number;
  volume?: number;
  volume_24h?: number;
  liquidity?: number;
  markets: WcMarketDto[] | null;
  market_count: number;
}

export interface WcPropsResponseDto {
  props: WcPropEventDto[] | null;
}

function exactBinaryOutcomes(
  market: WcMarketDto,
): { yes: WcOutcomeDto; no: WcOutcomeDto } | undefined {
  const outcomes = market.outcomes ?? [];
  if (outcomes.length !== 2) return undefined;
  const yes = outcomes.filter(
    (outcome) => outcome.name.trim().toLowerCase() === "yes",
  );
  const no = outcomes.filter(
    (outcome) => outcome.name.trim().toLowerCase() === "no",
  );
  return yes.length === 1 && no.length === 1
    ? { yes: yes[0], no: no[0] }
    : undefined;
}

function exactCandidateOutcome(
  market: WcMarketDto,
): WcOutcomeDto | undefined {
  const outcomes = market.outcomes ?? [];
  if (outcomes.length !== 2) return undefined;
  const no = outcomes.filter(
    (outcome) => outcome.name.trim().toLowerCase() === "no",
  );
  const candidates = outcomes.filter(
    (outcome) => outcome.name.trim().toLowerCase() !== "no",
  );
  return no.length === 1 && candidates.length === 1
    ? candidates[0]
    : undefined;
}

/** Adapt a single backend prop event into the local {@link WcProp} shape. */
function adaptPropEvent(dto: WcPropEventDto): WcProp {
  const markets = (dto.markets ?? []).filter((market) => market.status === "open");

  let outcomes: WcOutcome[] = [];
  const binary =
    markets.length === 1 ? exactBinaryOutcomes(markets[0]) : undefined;
  if (binary && markets[0].slug?.trim()) {
    // Single Yes/No market: keep both sides, Yes first (triggers the binary
    // buy-button layout in propToEvent), localize the canonical labels.
    // Yes/No are deterministic — translated client-side via i18n, not *_trans.
    outcomes = [
      outcomeBase("Yes", binary.yes, markets[0], { key: "yes" }),
      outcomeBase("No", binary.no, markets[0], { key: "no" }),
    ];
  } else {
    // Multi-candidate: one outcome per market (its candidate side), desc price.
    // Free-text candidate labels carry the backend's localized `*_trans`; team
    // candidates additionally carry a code so the UI can use its i18n name.
    const candidateOutcomes: WcOutcome[] = [];
    for (const m of markets) {
      const lead = exactCandidateOutcome(m);
      if (!lead || !m.slug?.trim()) {
        candidateOutcomes.length = 0;
        break;
      }
      const label = m.group_item_title || lead.name;
      const team = getTeamByName(label);
      candidateOutcomes.push({
        ...outcomeBase(label, lead, m, { key: "yes" }),
        labelTrans: m.group_item_title_trans ?? lead.name_trans,
        teamCode: team?.code,
      });
    }
    outcomes = candidateOutcomes.sort((a, b) => b.price - a.price);
  }

  return {
    slug: dto.slug,
    title: dto.title,
    titleTrans: dto.title_trans,
    volume: dto.volume ?? 0,
    marketCount: markets.length,
    outcomes,
  };
}

/** Adapt the props response, ordered by the backend's display order. */
export function adaptProps(dto: WcPropsResponseDto): WcProp[] {
  return (dto.props ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map(adaptPropEvent)
    .filter((event) => event.outcomes.length > 0);
}

export const WORLDCUP_PROPS_QUERY_KEY = ["worldcup", "props"] as const;

export async function fetchWorldcupProps(
  baseUrl: string,
  lang?: string,
): Promise<WcProp[]> {
  return getWorldcupJson<WcPropsResponseDto>(baseUrl, "props", lang).then(
    adaptProps,
  );
}

// ---------------------------------------------------------------------------
// Curated events (related-events rails surfaced outside the Props tab)
// ---------------------------------------------------------------------------

/** Curated rails the backend exposes; each reuses the {@link WcPropEventDto} shape. */
export type WcCuratedBucket = "standings" | "bracket";

export interface WcCuratedEventsResponseDto {
  bucket: string;
  events: WcPropEventDto[] | null;
}

/** Per-bucket key so each rail caches independently. */
export const worldcupCuratedQueryKey = (bucket: WcCuratedBucket) =>
  ["worldcup", "curated", bucket] as const;

/**
 * Fetch a curated rail and reuse the prop adapter — curated events are the same
 * `WCPropEvent` payload as `/props`, just pre-filtered into a themed bucket.
 */
export async function fetchWorldcupCurated(
  baseUrl: string,
  bucket: WcCuratedBucket,
  lang?: string,
): Promise<WcProp[]> {
  return getWorldcupJson<WcCuratedEventsResponseDto>(
    baseUrl,
    `curated-events?bucket=${bucket}`,
    lang,
  ).then((dto) => adaptProps({ props: dto.events }));
}
