import type { PredictEvent, PredictMarket } from "@liberfi.io/react-predict";

/**
 * World Cup domain types — self-contained in the template (ADR-6).
 *
 * These intentionally do NOT live in `@liberfi.io/types`: they model the
 * worldcup BFF shape only. Prices are probabilities in [0,1] (Polymarket
 * convention) so `convertPrice` can render them in any of the 8 formats.
 */

export interface WcTeam {
  /** Uppercase 2–3 letter code, e.g. "MEX". */
  code: string;
  name: string;
  nameZh: string;
  /** Team theme colour (hex). */
  color: string;
  /** Flag image URL. */
  flag: string;
}

export type WcMatchStatus = "scheduled" | "live" | "final";

export interface WcMatchLiveState {
  matchId: string;
  upstreamGameId?: string;
  source: string;
  league?: string;
  sport?: string;
  status: WcMatchStatus;
  score?: { home: number; away: number };
  period?: string;
  elapsed?: string;
  live: boolean;
  ended: boolean;
  observedAt: string;
  updatedAt?: string;
}

export interface WcMatchLiveVideo {
  url: string;
  type: number;
  status: number;
  source?: string;
}

export interface WcOutcome {
  /** English base label (Convention B). */
  label: string;
  /**
   * Localized label for the active request language, from the backend's
   * `*_trans` field (Convention B). Undefined for deterministic labels
   * (Yes/No, team names) that are translated client-side via i18n instead.
   */
  labelTrans?: string;
  /** Probability/price in [0,1]. */
  price: number;
  /** Optional team code for flag rendering in props. */
  teamCode?: string;
}

export interface WcMoneyline {
  home: WcOutcome;
  draw: WcOutcome;
  away: WcOutcome;
}

export interface WcSpread {
  /** Favourite handicap line, e.g. -1.5 applied to the home side. */
  line: number;
  home: WcOutcome;
  away: WcOutcome;
}

export interface WcTotal {
  /** Goals line, e.g. 2.5. */
  line: number;
  over: WcOutcome;
  under: WcOutcome;
}

/** Card-level trade markets returned by the matches list endpoint. */
export interface WcMatchTradeMarkets {
  moneylineHome?: PredictMarket;
  moneylineDraw?: PredictMarket;
  moneylineAway?: PredictMarket;
  spreadHome?: PredictMarket;
  spreadAway?: PredictMarket;
  spread?: PredictMarket;
  total?: PredictMarket;
}

export interface WcMatch {
  matchId: string;
  /** e.g. "group-A", "r32", "r16", "r8", "r4", "r3rd", "final". */
  stage: string;
  groupCode?: string;
  kickoffMs: number;
  status: WcMatchStatus;
  home: WcTeam;
  away: WcTeam;
  /** Polymarket event slug → detail page. */
  slug: string;
  volume: number;
  /** Number of sub-markets in the event (shown on the "match view" pill). */
  marketCount: number;
  /**
   * TheSports live-widget match id (the `uuid` in the embed URL). Present for
   * group matches; absent for not-yet-drawn knockout fixtures.
   */
  thesportsMatchId?: string;
  moneyline: WcMoneyline;
  spread: WcSpread;
  total: WcTotal;
  /** Lightweight event shell for opening the card trade sheet without a detail fetch. */
  tradeEvent?: PredictEvent;
  /** Full SDK market objects for the odds buttons shown on the card. */
  tradeMarkets?: WcMatchTradeMarkets;
  /** Live-only. */
  liveScore?: { home: number; away: number };
  /** Live-only, e.g. "2nd · 67'". */
  livePeriod?: string;
  liveState?: WcMatchLiveState;
  liveVideos?: WcMatchLiveVideo[];
}

export interface WcStandingRow {
  rank: number;
  team: WcTeam;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  /** Last-5 form, null = not played. */
  form: Array<"W" | "D" | "L" | null>;
  /** Advance-to-knockout probability in [0,1]. Omitted until the advance market is wired. */
  advance?: number;
}

export interface WcGroup {
  code: string;
  label: string;
  teams: WcStandingRow[];
}

export interface WcThirdPlaceRow {
  /** Overall rank among the 12 third-placed teams (1 = best). */
  rank: number;
  /** Source group code, e.g. "A". */
  group: string;
  team: WcTeam;
  /** Advance-to-knockout probability in [0,1]. Omitted until the advance market is wired. */
  advance?: number;
  /** True for the best 8 third-placed teams that reach the Round of 32. */
  qualifies: boolean;
}

export interface WcProp {
  slug: string;
  /** English base title (Convention B). */
  title: string;
  /** Localized title for the active request language (backend `title_trans`). */
  titleTrans?: string;
  volume: number;
  marketCount: number;
  /** Top outcomes for the card preview, already sorted desc by price. */
  outcomes: WcOutcome[];
}

export interface WcBracketNode {
  matchId: string;
  /** "r32" | "r16" | "r8" | "r4" | "r3rd" | "final". */
  round: string;
  /** Resolved team or placeholder label, e.g. "2A", "W74", "3ABCDF". */
  homeLabel: string;
  awayLabel: string;
  /** Resolved teams once known (static dataset: undefined pre-tournament). */
  homeTeam?: WcTeam;
  awayTeam?: WcTeam;
  venue: string;
  city: string;
  kickoffMs: number;
}

export const BRACKET_ROUNDS = ["r32", "r16", "r8", "r4", "r3rd", "final"] as const;

// ---------------------------------------------------------------------------
// Market news (social / Twitter feeds)
// ---------------------------------------------------------------------------

export interface WcFeedUser {
  id?: string;
  handle?: string;
  name?: string;
  avatar?: string;
  /** e.g. "blue" | "business"; empty when unverified. */
  verifiedType?: string;
}

export interface WcFeedMedia {
  type: "image" | "video";
  url: string;
  /** Poster/thumbnail for videos. */
  thumbnail?: string;
}

export interface WcFeed {
  id: string;
  tweetId?: string;
  originTweetId?: string;
  /** tweet | retweet | reply | quote */
  type: string;
  text?: string;
  /** Unix milliseconds. */
  timestampMs: number;
  user: WcFeedUser;
  /** Videos first, then images (mirrors the upstream ordering). */
  medias: WcFeedMedia[];
  categories: string[];
  significance?: number;
  source?: string;
}

export interface WcFeedPage {
  items: WcFeed[];
  /** Opaque cursor for the next page; absent when there are no more. */
  nextCursor?: string;
  hasMore: boolean;
}
