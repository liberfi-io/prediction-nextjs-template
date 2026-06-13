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

import type { PredictEvent } from "@liberfi.io/react-predict";
import type {
  WcBracketNode,
  WcFeed,
  WcFeedMedia,
  WcFeedPage,
  WcGroup,
  WcMatch,
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
  best_ask?: number;
}

export interface WcMarketDto {
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
    draw: { label: "Draw", price: drawP },
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
      over: { label: "Over", price: 0 },
      under: { label: "Under", price: 0 },
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
    over: { label: "Over", price: overP },
    under: { label: "Under", price: underP },
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

function adaptMatch(dto: WcMatchDto): WcMatch {
  const home = getTeam(dto.home_team.team_code);
  const away = getTeam(dto.away_team.team_code);
  const homeKeys = teamKeys(dto.home_team, home);
  const awayKeys = teamKeys(dto.away_team, away);
  const markets = dto.markets ?? [];
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

/**
 * Fetch a single World Cup match as a full {@link PredictEvent} with every
 * market aggregated across its four Polymarket event slugs (moneyline, spreads,
 * totals, both-teams-to-score, exact score, halftime). Hits the dedicated
 * `GET /api/v1/worldcup/matches/{slug}` endpoint; the response is already the
 * snake_case PredictEvent shape (no adapter needed), so the SDK leaf components
 * (`EventPriceChart`, `EventMarketDetailWidget`, `TradeFormWidget`) consume it
 * directly.
 */
export async function fetchWorldcupMatchEvent(
  baseUrl: string,
  slug: string,
  lang?: string,
): Promise<PredictEventWithWorldcupLive> {
  return getWorldcupJson<PredictEventWithWorldcupLive>(
    baseUrl,
    `matches/${encodeURIComponent(slug)}`,
    lang,
  );
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

/**
 * A prop event is "binary" when it is a single Yes/No market (e.g. "Will Messi
 * play?"). Multi-candidate events (winner, top scorer, group winners, ...) hold
 * one market per candidate, each `[candidate, "No"]`.
 */
function isBinaryProp(markets: WcMarketDto[]): boolean {
  if (markets.length !== 1) return false;
  const names = (markets[0].outcomes ?? []).map((o) => o.name.toLowerCase());
  return names.includes("no") && names.includes("yes");
}

/** Pick the candidate ("non-No") outcome of a per-candidate prop market. */
function leadOutcome(market: WcMarketDto): WcOutcomeDto | undefined {
  const outcomes = market.outcomes ?? [];
  return outcomes.find((o) => o.name.toLowerCase() !== "no") ?? outcomes[0];
}

/** Adapt a single backend prop event into the local {@link WcProp} shape. */
function adaptPropEvent(dto: WcPropEventDto): WcProp {
  const markets = dto.markets ?? [];

  let outcomes: WcOutcome[];
  if (isBinaryProp(markets)) {
    // Single Yes/No market: keep both sides, Yes first (triggers the binary
    // buy-button layout in propToEvent), localize the canonical labels.
    const byName = new Map(
      (markets[0].outcomes ?? []).map((o) => [o.name.toLowerCase(), o]),
    );
    const yes = byName.get("yes");
    const no = byName.get("no");
    // Yes/No are deterministic — translated client-side via i18n, not *_trans.
    outcomes = [
      { label: "Yes", price: yes?.price ?? 0 },
      { label: "No", price: no?.price ?? 0 },
    ];
  } else {
    // Multi-candidate: one outcome per market (its candidate side), desc price.
    // Free-text candidate labels carry the backend's localized `*_trans`; team
    // candidates additionally carry a code so the UI can use its i18n name.
    outcomes = markets
      .map((m): WcOutcome | null => {
        const lead = leadOutcome(m);
        if (!lead) return null;
        const label = m.group_item_title || lead.name;
        const team = getTeamByName(label);
        return {
          label,
          labelTrans: m.group_item_title_trans ?? lead.name_trans,
          teamCode: team?.code,
          price: lead.price ?? 0,
        };
      })
      .filter((o): o is WcOutcome => o !== null)
      .sort((a, b) => b.price - a.price);
  }

  return {
    slug: dto.slug,
    title: dto.title,
    titleTrans: dto.title_trans,
    volume: dto.volume ?? 0,
    marketCount: dto.market_count,
    outcomes,
  };
}

/** Adapt the props response, ordered by the backend's display order. */
export function adaptProps(dto: WcPropsResponseDto): WcProp[] {
  return (dto.props ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map(adaptPropEvent);
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
