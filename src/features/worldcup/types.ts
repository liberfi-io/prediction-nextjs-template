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

export interface WcOutcome {
  label: string;
  labelZh?: string;
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
  /** Live-only. */
  liveScore?: { home: number; away: number };
  /** Live-only, e.g. "2nd · 67'". */
  livePeriod?: string;
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
  /** Advance-to-knockout probability in [0,1]. */
  advance: number;
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
  /** Advance-to-knockout probability in [0,1]. */
  advance: number;
  /** True for the best 8 third-placed teams that reach the Round of 32. */
  qualifies: boolean;
}

export interface WcProp {
  slug: string;
  titleEn: string;
  titleZh: string;
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

export const BRACKET_ROUNDS: Array<{ id: string; en: string; zh: string }> = [
  { id: "r32", en: "Round of 32", zh: "32 强" },
  { id: "r16", en: "Round of 16", zh: "16 强" },
  { id: "r8", en: "Quarter-finals", zh: "1/4 决赛" },
  { id: "r4", en: "Semi-finals", zh: "半决赛" },
  { id: "r3rd", en: "Third place", zh: "季军赛" },
  { id: "final", en: "Final", zh: "决赛" },
];
