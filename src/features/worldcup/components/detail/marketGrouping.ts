/**
 * Groups a World Cup match's full market set (returned by
 * `GET /api/v1/worldcup/matches/{slug}`) into the categories and selectable
 * groups the Markets panel renders. Replicates future.news' market switcher:
 *
 *   Game Lines      = moneyline + both_teams_to_score + spreads + totals + first-to-score
 *   Exact Score     = soccer_exact_score
 *   Halftime Result = soccer_halftime_result
 *   Extended groups = team totals, half lines, corners, player goals/assists/shots/saves
 *
 * Each group exposes the inline outcome/line options (Moneyline = home/draw/away,
 * Spreads = handicap lines, Totals = goal lines, ...) used to pick the active
 * market. All sports metadata is read from `provider_meta` (snake_case keys
 * `polymarket.sportsMarketType` / `polymarket.line` / `polymarket.groupItemTitle`).
 */

import type { PredictMarket } from "@liberfi.io/react-predict";
import { formatLine } from "../../odds/convert-price";

export type SportsMarketType =
  | "moneyline"
  | "soccer_match_winner"
  | "spreads"
  | "totals"
  | "both_teams_to_score"
  | "soccer_exact_score"
  | "soccer_halftime_result"
  | "soccer_second_half_result"
  | "soccer_first_to_score"
  | "soccer_team_totals"
  | "both_teams_to_score_first_half"
  | "both_teams_to_score_second_half"
  | "first_half_totals"
  | "second_half_totals"
  | "soccer_first_half_team_totals"
  | "soccer_second_half_team_totals"
  | "soccer_second_half_total_corners"
  | "soccer_team_total_corners"
  | "total_corners"
  | "soccer_game_corners_odd_even"
  | "soccer_first_half_total_corners"
  | "soccer_first_corner"
  | "soccer_player_goals"
  | "soccer_player_goals_plus_assists"
  | "soccer_player_assists"
  | "soccer_player_shots"
  | "soccer_player_shots_on_target"
  | "soccer_player_goalkeeper_saves"
  | "other";

export type MarketCategory =
  | "gameLines"
  | "exactScore"
  | "halftime"
  | "secondHalf"
  | "corners"
  | "goals"
  | "assists"
  | "shots"
  | "saves"
  | "other";

/** One selectable option inside a group (maps 1:1 to a market). */
export interface MarketOption {
  market: PredictMarket;
  /** Short button label, e.g. "Mexico", "-1.5", "0.5", "1-0". */
  label: string;
  /** Numeric sort key within the group. */
  sort: number;
  /** Binary outcome selected by this option. Defaults to YES. */
  outcome?: "yes" | "no";
  /** Shared line value used by spread / totals line pickers. */
  line?: number;
  /** Signed handicap displayed next to a team in spread markets. */
  handicap?: number;
  /** Side represented by the option when a line has two selectable sides. */
  side?: "home" | "away" | "over" | "under";
  /** Team represented by team-total markets. */
  teamSide?: "home" | "away";
}

/** A market group rendered as one row in the Markets panel. */
export interface MarketGroup {
  /** Stable key, e.g. "moneyline" / "spreads". */
  key: string;
  type: SportsMarketType;
  /** Group display label (i18n key suffix), e.g. "moneyline". */
  type_label: SportsMarketType;
  options: MarketOption[];
  /** Aggregate USD volume across the group's markets. */
  volume: number;
}

export interface CategorizedMarkets {
  gameLines: MarketGroup[];
  exactScore: MarketGroup[];
  halftime: MarketGroup[];
  secondHalf: MarketGroup[];
  corners: MarketGroup[];
  goals: MarketGroup[];
  assists: MarketGroup[];
  shots: MarketGroup[];
  saves: MarketGroup[];
  other: MarketGroup[];
}

/** Hint used to orient spread handicaps from the home team's perspective. */
export interface TeamHint {
  homeKeys: Set<string>;
  awayKeys: Set<string>;
  homeLabel?: string;
  awayLabel?: string;
  drawLabel?: string;
  moneylineDrawLabel?: string;
  teamWinsLabel?: (team: string) => string;
  yesLabel?: string;
  noLabel?: string;
  firstHalfTotalsLabel?: string;
  secondHalfTotalsLabel?: string;
  totalCornersLabel?: string;
  teamTotalCornersLabel?: string;
  firstHalfTotalCornersLabel?: string;
  secondHalfTotalCornersLabel?: string;
  firstHalfPrefixLabel?: string;
  secondHalfPrefixLabel?: string;
  periodMarketLabel?: (period: string, market: string) => string;
  playerGoalsLabel?: string;
  goalkeeperSavesLabel?: string;
  playerGoalsShortLabel?: string;
  goalkeeperSavesShortLabel?: string;
  playerAssistsShortLabel?: string;
  playerGoalsPlusAssistsShortLabel?: string;
  playerShotsShortLabel?: string;
  playerShotsOnTargetShortLabel?: string;
  neitherLabel?: string;
  anyOtherScoreLabel?: string;
}

// ---------------------------------------------------------------------------
// provider_meta readers
// ---------------------------------------------------------------------------

function meta(m: PredictMarket, key: string): unknown {
  return m.provider_meta?.[key];
}

export function sportsType(m: PredictMarket): SportsMarketType {
  const t = meta(m, "polymarket.sportsMarketType");
  return typeof t === "string" ? (t as SportsMarketType) : "other";
}

export function marketLine(m: PredictMarket): number | undefined {
  const l = meta(m, "polymarket.line");
  return typeof l === "number" ? l : undefined;
}

function groupItemTitle(m: PredictMarket): string {
  const t = meta(m, "polymarket.groupItemTitle");
  return typeof t === "string" ? t : "";
}

function groupItemTitleTrans(m: PredictMarket): string {
  const direct = (m as PredictMarket & { group_item_title_trans?: unknown })
    .group_item_title_trans;
  if (typeof direct === "string") return direct;
  for (const key of [
    "polymarket.groupItemTitleTrans",
    "polymarket.groupItemTitle_trans",
    "polymarket.group_item_title_trans",
  ]) {
    const metaValue = meta(m, key);
    if (typeof metaValue === "string") return metaValue;
  }
  return "";
}

function questionTrans(m: PredictMarket): string {
  const direct = (m as PredictMarket & { question_trans?: unknown }).question_trans;
  return typeof direct === "string" ? direct : "";
}

function finitePrice(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function samePrice(a: number | undefined, b: number | undefined): boolean {
  return a !== undefined && b !== undefined && Math.abs(a - b) < 0.000001;
}

function binaryQuotes(m: PredictMarket):
  | {
      yesBid?: number;
      yesAsk?: number;
      noBid?: number;
      noAsk?: number;
    }
  | undefined {
  const yes = m.outcomes?.[0];
  const no = m.outcomes?.[1];
  if (!yes || !no) return undefined;
  return {
    yesBid: finitePrice(yes.best_bid),
    yesAsk: finitePrice(yes.best_ask),
    noBid: finitePrice(no.best_bid),
    noAsk: finitePrice(no.best_ask),
  };
}

/**
 * Some World Cup snapshots carry impossible binary top-of-book states. When
 * both outcome books are crossed, recover the YES side from the NO book.
 */
function correctedYesAsk(m: PredictMarket): number | undefined {
  const q = binaryQuotes(m);
  if (!q) return undefined;

  // Exact duplicates are usually a copied NO book. Buying YES crosses NO bid.
  if (
    samePrice(q.yesBid, q.noBid) &&
    samePrice(q.yesAsk, q.noAsk) &&
    (q.yesBid ?? 0) > 0.5 &&
    (q.yesAsk ?? 0) > 0.5
  ) {
    return q.noBid !== undefined ? 1 - q.noBid : undefined;
  }

  // If both bid and ask sums are far above one, the YES snapshot is inverted.
  // The live YES ask matches the complement of the NO ask in these cases.
  return (
    q.yesBid !== undefined &&
    q.yesAsk !== undefined &&
    q.noBid !== undefined &&
    q.noAsk !== undefined &&
    q.yesBid + q.noBid > 1.1 &&
    q.yesAsk + q.noAsk > 1.1
  )
    ? 1 - q.noAsk
    : undefined;
}

/** YES (primary) outcome probability in [0,1]. */
export function yesPrice(m: PredictMarket): number {
  const corrected = correctedYesAsk(m);
  if (corrected !== undefined) return corrected;
  return m.outcomes?.[0]?.price ?? m.outcomes?.[0]?.best_ask ?? 0;
}

/**
 * YES (primary) outcome best ask in [0,1] — the price you pay to buy a YES
 * share. Used for the Markets panel's displayed price so it lines up with the
 * order book's best-ask line (the static snapshot; the live order book is
 * layered on top for the selected market).
 */
export function yesAskPrice(m: PredictMarket): number {
  const settledPrice = finitePrice(m.outcomes?.[0]?.price);
  if (m.status !== "open" && settledPrice !== undefined) return settledPrice;

  const corrected = correctedYesAsk(m);
  if (corrected !== undefined) return corrected;
  return m.outcomes?.[0]?.best_ask ?? m.outcomes?.[0]?.price ?? 0;
}

/** Strip the trailing " (...)" qualifier Polymarket appends to group titles. */
function cleanTitle(raw: string): string {
  const asciiIdx = raw.indexOf(" (");
  const fullWidthIdx = raw.indexOf("（");
  const candidates = [asciiIdx, fullWidthIdx].filter((idx) => idx > 0);
  const idx = candidates.length ? Math.min(...candidates) : -1;
  return (idx > 0 ? raw.slice(0, idx) : raw).trim();
}

function normalizeLabel(raw: string): string {
  return cleanTitle(raw).trim().toLowerCase();
}

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceKnownTeamLabels(raw: string, hint?: TeamHint): string {
  if (!hint) return raw;
  let next = raw;
  const replaceAll = (keys: Set<string>, label?: string) => {
    if (!label) return;
    const sorted = [...keys].filter(Boolean).sort((a, b) => b.length - a.length);
    for (const key of sorted) {
      const boundary = key.length <= 3 ? "\\b" : "";
      next = next.replace(
        new RegExp(`${boundary}${escapeRegExp(key)}${boundary}`, "gi"),
        label,
      );
    }
  };
  replaceAll(hint.homeKeys, hint.homeLabel);
  replaceAll(hint.awayKeys, hint.awayLabel);
  return next;
}

function localizeKnownLabel(raw: string, hint?: TeamHint): string {
  if (!hint) return raw;
  const normalized = normalizeLabel(raw);
  const withLocalizedTeams = replaceKnownTeamLabels(cleanTitle(raw), hint);
  if (hint.homeLabel && hint.homeKeys.has(normalized)) return hint.homeLabel;
  if (hint.awayLabel && hint.awayKeys.has(normalized)) return hint.awayLabel;
  if (hint.drawLabel && (normalized === "draw" || normalized === "tie" || normalized === "平")) {
    return hint.drawLabel;
  }
  if (hint.yesLabel && normalized === "yes") return hint.yesLabel;
  if (hint.noLabel && normalized === "no") return hint.noLabel;
  if (hint.neitherLabel && normalized === "neither") return hint.neitherLabel;
  if (hint.anyOtherScoreLabel && normalized === "any other score") {
    return hint.anyOtherScoreLabel;
  }

  const lineLabel = (
    label: string | undefined,
    line: string | undefined,
    team: string | undefined,
  ) => label && line ? `${team ? `${team} ` : ""}${label} ${line}` : undefined;
  const thresholdLabel = (
    match: RegExpMatchArray | null,
    label: string | undefined,
  ) => {
    if (!match?.[2] || !label) return undefined;
    return `${match[1] ? `${match[1]}: ` : ""}${match[2]}+ ${label}`;
  };
  const teamPrefix = "(.+?)\\s+";

  const fixed =
    lineLabel(
      hint.firstHalfTotalsLabel,
      normalized.match(/^(?:.+?\s+)?1st half o\/u\s+(.+)$/)?.[1],
      withLocalizedTeams.match(new RegExp(`^${teamPrefix}1st half o/u\\s+.+$`, "i"))?.[1],
    ) ??
    lineLabel(
      hint.secondHalfTotalsLabel,
      normalized.match(/^(?:.+?\s+)?2nd half o\/u\s+(.+)$/)?.[1],
      withLocalizedTeams.match(new RegExp(`^${teamPrefix}2nd half o/u\\s+.+$`, "i"))?.[1],
    ) ??
    lineLabel(
      hint.totalCornersLabel,
      normalized.match(/^total corners:?\s+o\/u\s+(.+)$/)?.[1],
      undefined,
    ) ??
    lineLabel(
      hint.teamTotalCornersLabel,
      normalized.match(/^(?:.+?\s+)?corners:?\s+o\/u\s+(.+)$/)?.[1],
      withLocalizedTeams.match(new RegExp(`^${teamPrefix}corners:?\\s+o/u\\s+.+$`, "i"))?.[1],
    ) ??
    lineLabel(
      hint.firstHalfTotalCornersLabel,
      normalized.match(/^1st half total corners:?\s+o\/u\s+(.+)$/)?.[1],
      undefined,
    ) ??
    lineLabel(
      hint.secondHalfTotalCornersLabel,
      normalized.match(/^2nd half total corners:?\s+o\/u\s+(.+)$/)?.[1],
      undefined,
    ) ??
    thresholdLabel(
      withLocalizedTeams.match(/^(?:(.+?):?\s+)?(\d+(?:\.\d+)?)\+\s+goals?\s*\+\s*assists?$/i),
      hint.playerGoalsPlusAssistsShortLabel,
    ) ??
    thresholdLabel(
      withLocalizedTeams.match(/^(?:(.+?):?\s+)?(\d+(?:\.\d+)?)\+\s+goals?$/i),
      hint.playerGoalsShortLabel,
    ) ??
    thresholdLabel(
      withLocalizedTeams.match(/^(?:(.+?):?\s+)?(\d+(?:\.\d+)?)\+\s+saves?$/i),
      hint.goalkeeperSavesShortLabel,
    ) ??
    thresholdLabel(
      withLocalizedTeams.match(/^(?:(.+?):?\s+)?(\d+(?:\.\d+)?)\+\s+assists?$/i),
      hint.playerAssistsShortLabel,
    ) ??
    thresholdLabel(
      withLocalizedTeams.match(/^(?:(.+?):?\s+)?(\d+(?:\.\d+)?)\+\s+shots?\s+on\s+target$/i),
      hint.playerShotsOnTargetShortLabel,
    ) ??
    thresholdLabel(
      withLocalizedTeams.match(/^(?:(.+?):?\s+)?(\d+(?:\.\d+)?)\+\s+shots?$/i),
      hint.playerShotsShortLabel,
    );
  if (fixed) return fixed;

  return withLocalizedTeams;
}

/**
 * Best human label for a market: localized cleaned group title when present,
 * else base group title / question.
 */
export function marketLabel(m: PredictMarket, hint?: TeamHint): string {
  const type = sportsType(m);
  const label =
    cleanTitle(groupItemTitleTrans(m) || groupItemTitle(m)) ||
    questionTrans(m) ||
    m.question ||
    m.slug;
  if (isMatchResultType(type)) {
    const moneylineLabel = moneylineMarketLabel(label, hint);
    if (moneylineLabel) return periodMarketLabel(type, moneylineLabel, hint);
  }
  return localizeKnownLabel(label, hint);
}

function isMatchResultType(type: SportsMarketType): boolean {
  return (
    type === "moneyline" ||
    type === "soccer_match_winner" ||
    type === "soccer_halftime_result" ||
    type === "soccer_second_half_result"
  );
}

function moneylineMarketLabel(raw: string, hint?: TeamHint): string | undefined {
  if (!hint) return undefined;
  const normalized = normalizeLabel(raw);
  if (
    isDrawTitle(normalized) ||
    normalized.includes("draw") ||
    normalized.includes("tie") ||
    normalized === hint.drawLabel?.trim().toLowerCase() ||
    normalized === hint.moneylineDrawLabel?.trim().toLowerCase()
  ) {
    return hint.moneylineDrawLabel ?? hint.drawLabel;
  }

  const homeLabel = hint.homeLabel;
  const awayLabel = hint.awayLabel;
  const team =
    [...hint.homeKeys].some((key) => key && normalized.includes(key))
      ? homeLabel
      : [...hint.awayKeys].some((key) => key && normalized.includes(key))
        ? awayLabel
        : undefined;
  if (!team) return undefined;

  return hint.teamWinsLabel ? hint.teamWinsLabel(team) : `${team} wins`;
}

export function periodMarketLabel(
  type: SportsMarketType,
  label: string,
  hint?: TeamHint,
): string {
  const period =
    type === "soccer_halftime_result" ||
    type === "first_half_totals" ||
    type === "soccer_first_half_team_totals" ||
    type === "both_teams_to_score_first_half"
      ? hint?.firstHalfPrefixLabel
      : type === "soccer_second_half_result" ||
          type === "second_half_totals" ||
          type === "soccer_second_half_team_totals" ||
          type === "both_teams_to_score_second_half"
        ? hint?.secondHalfPrefixLabel
        : undefined;
  if (!period) return label;
  return hint?.periodMarketLabel ? hint.periodMarketLabel(period, label) : `${period} ${label}`;
}

// ---------------------------------------------------------------------------
// Group builders
// ---------------------------------------------------------------------------

function sumVolume(markets: PredictMarket[]): number {
  return markets.reduce((acc, m) => acc + (m.volume ?? 0), 0);
}

/** Match a spread market to home/away by scanning its title/question. */
function spreadFavoursHome(m: PredictMarket, hint?: TeamHint): boolean {
  const text = `${groupItemTitle(m)} ${m.question}`.toLowerCase();
  if (hint) {
    for (const k of hint.awayKeys) if (k && text.includes(k)) return false;
    for (const k of hint.homeKeys) if (k && text.includes(k)) return true;
  }
  // Fallback: keep the raw (home-favoured) orientation.
  return true;
}

function buildMoneyline(markets: PredictMarket[], hint?: TeamHint): MarketGroup {
  const options = markets.map(
    (m, i): MarketOption => {
      const text = `${groupItemTitle(m)} ${groupItemTitleTrans(m)} ${m.question}`.toLowerCase();
      const label = marketLabel(m, hint);
      const sort = matchResultSort(text, i, hint);
      return { market: m, label, sort };
    },
  ).sort((a, b) => a.sort - b.sort);
  return {
    key: "moneyline",
    type: "moneyline",
    type_label: "moneyline",
    options,
    volume: sumVolume(markets),
  };
}

function isDrawTitle(title: string): boolean {
  return title.startsWith("draw") || title.startsWith("tie") || title.includes("平");
}

function matchResultSort(text: string, fallback: number, hint?: TeamHint): number {
  if (!hint) return fallback;
  if (isDrawTitle(text)) return 1;
  if ([...hint.homeKeys].some((key) => key && text.includes(key))) return 0;
  if ([...hint.awayKeys].some((key) => key && text.includes(key))) return 2;
  return fallback + 3;
}

function buildSpreads(markets: PredictMarket[], hint?: TeamHint): MarketGroup {
  const options = markets
    .flatMap((m): MarketOption[] => {
      const line = marketLine(m) ?? 0;
      const favoursHome = spreadFavoursHome(m, hint);
      const homeLine = favoursHome ? line : -line;
      const awayLine = -homeLine;
      const selectorLine = homeLine;
      const homeLabel = hint?.homeLabel ?? marketLabel(m, hint);
      const awayLabel = hint?.awayLabel ?? marketLabel(m, hint);
      return [
        {
          market: m,
          label: homeLabel,
          sort: selectorLine,
          line: selectorLine,
          handicap: homeLine,
          side: "home",
          outcome: favoursHome ? "yes" : "no",
        },
        {
          market: m,
          label: awayLabel,
          sort: selectorLine,
          line: selectorLine,
          handicap: awayLine,
          side: "away",
          outcome: favoursHome ? "no" : "yes",
        },
      ];
    })
    .sort((a, b) => a.sort - b.sort || sideSort(a.side) - sideSort(b.side));
  return {
    key: "spreads",
    type: "spreads",
    type_label: "spreads",
    options,
    volume: sumVolume(markets),
  };
}

function sideSort(side: MarketOption["side"]): number {
  if (side === "home" || side === "over") return 0;
  if (side === "away" || side === "under") return 1;
  return 2;
}

function buildTotals(markets: PredictMarket[]): MarketGroup {
  const options = markets
    .map((m): MarketOption => {
      const line = marketLine(m) ?? 0;
      return { market: m, label: formatLine(line, false), sort: line, line };
    })
    .sort((a, b) => a.sort - b.sort);
  return {
    key: "totals",
    type: "totals",
    type_label: "totals",
    options,
    volume: sumVolume(markets),
  };
}

function buildTotalsList(
  key: string,
  type: SportsMarketType,
  markets: PredictMarket[],
  hint?: TeamHint,
): MarketGroup {
  const teamTotals = isTeamTotalsType(type);
  const options = markets
    .map((m): MarketOption => {
      const line = marketLine(m);
      const teamSide = teamTotals ? teamTotalSide(m, hint) : undefined;
      return {
        market: m,
        label: teamSide
          ? teamSide === "home"
            ? hint?.homeLabel ?? marketLabel(m, hint)
            : hint?.awayLabel ?? marketLabel(m, hint)
          : marketLabel(m, hint),
        sort: line ?? Number.MAX_SAFE_INTEGER,
        line,
        teamSide,
      };
    })
    .sort(
      (a, b) =>
        teamSideSort(a.teamSide) - teamSideSort(b.teamSide) ||
        a.sort - b.sort ||
        a.label.localeCompare(b.label),
    );
  return { key, type, type_label: type, options, volume: sumVolume(markets) };
}

function isTeamTotalsType(type: SportsMarketType): boolean {
  return (
    type === "soccer_team_totals" ||
    type === "soccer_first_half_team_totals" ||
    type === "soccer_second_half_team_totals" ||
    type === "soccer_team_total_corners"
  );
}

function teamSideSort(side: MarketOption["teamSide"]): number {
  if (side === "home") return 0;
  if (side === "away") return 1;
  return 2;
}

function teamTotalSide(
  market: PredictMarket,
  hint?: TeamHint,
): MarketOption["teamSide"] {
  if (!hint) return undefined;
  const label = marketLabel(market, hint).toLowerCase();
  const homeLabel = hint.homeLabel?.toLowerCase();
  const awayLabel = hint.awayLabel?.toLowerCase();
  if (homeLabel && label.startsWith(homeLabel)) return "home";
  if (awayLabel && label.startsWith(awayLabel)) return "away";

  const titleText = [
    groupItemTitle(market),
    groupItemTitleTrans(market),
  ].join(" ").toLowerCase();
  for (const key of hint.homeKeys) if (key && titleText.includes(key)) return "home";
  for (const key of hint.awayKeys) if (key && titleText.includes(key)) return "away";

  const fallbackText = [questionTrans(market), market.question, market.slug]
    .join(" ")
    .toLowerCase();
  for (const key of hint.homeKeys) if (key && fallbackText.includes(key)) return "home";
  for (const key of hint.awayKeys) if (key && fallbackText.includes(key)) return "away";
  return undefined;
}

/** A binary market (e.g. Both Teams to Score) → YES / NO options. */
function buildSingle(
  key: string,
  type: SportsMarketType,
  markets: PredictMarket[],
  hint?: TeamHint,
): MarketGroup {
  const market = markets.find((m) => m.status === "open") ?? markets[0];
  return {
    key,
    type,
    type_label: type,
    options: market
      ? [
          {
            market,
            label: hint?.yesLabel ?? "Yes",
            sort: 0,
            outcome: "yes",
          },
          {
            market,
            label: hint?.noLabel ?? "No",
            sort: 1,
            outcome: "no",
          },
        ]
      : [],
    volume: sumVolume(markets),
  };
}

/** Strip a leading "<prefix>: " qualifier, e.g. "Exact Score: 2-0" → "2-0". */
function stripLabelPrefix(label: string): string {
  const idx = label.indexOf(": ");
  return idx >= 0 ? label.slice(idx + 2).trim() : label;
}

/** A flat list group (exact score / halftime) sorted by probability desc. */
function buildList(
  key: string,
  type: SportsMarketType,
  markets: PredictMarket[],
  typeLabel: SportsMarketType = type,
  hint?: TeamHint,
): MarketGroup {
  // Exact-score options carry an "Exact Score: " prefix (e.g.
  // "Exact Score: 2-0"); drop it so only the scoreline shows everywhere it is
  // surfaced (panel buttons, chart legend, trade form title).
  const stripPrefix = type === "soccer_exact_score";
  const sortAsMatchResult =
    type === "soccer_halftime_result" ||
    type === "soccer_second_half_result";
  const options = markets
    .map((m, i): MarketOption => {
      const raw = marketLabel(m, hint);
      const text = `${groupItemTitle(m)} ${groupItemTitleTrans(m)} ${m.question}`.toLowerCase();
      return {
        market: m,
        label: stripPrefix ? stripLabelPrefix(raw) : raw,
        sort: sortAsMatchResult ? matchResultSort(text, i, hint) : yesPrice(m),
      };
    })
    .sort((a, b) =>
      sortAsMatchResult ? a.sort - b.sort : b.sort - a.sort,
    );
  return { key, type, type_label: typeLabel, options, volume: sumVolume(markets) };
}

function buildTypedLists(
  prefix: string,
  types: SportsMarketType[],
  byType: Map<SportsMarketType, PredictMarket[]>,
  typeLabel?: SportsMarketType,
  hint?: TeamHint,
): MarketGroup[] {
  const groups: MarketGroup[] = [];
  for (const type of types) {
    const markets = byType.get(type);
    if (markets?.length) {
      groups.push(buildList(`${prefix}:${type}`, type, markets, typeLabel, hint));
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Bucket every market into its category + group. Empty groups are dropped so
 * the panel only renders categories that have markets.
 */
export function categorizeMarkets(
  markets: PredictMarket[],
  hint?: TeamHint,
): CategorizedMarkets {
  const byType = new Map<SportsMarketType, PredictMarket[]>();
  for (const m of markets) {
    const t = sportsType(m);
    const arr = byType.get(t) ?? [];
    arr.push(m);
    byType.set(t, arr);
  }

  const gameLines: MarketGroup[] = [];
  const moneyline = [
    ...(byType.get("moneyline") ?? []),
    ...(byType.get("soccer_match_winner") ?? []),
  ];
  if (moneyline.length) gameLines.push(buildMoneyline(moneyline, hint));
  const btts = byType.get("both_teams_to_score");
  if (btts?.length) gameLines.push(buildSingle("btts", "both_teams_to_score", btts, hint));
  const spreads = byType.get("spreads");
  if (spreads?.length) gameLines.push(buildSpreads(spreads, hint));
  const totals = byType.get("totals");
  if (totals?.length) gameLines.push(buildTotals(totals));
  const firstToScore = byType.get("soccer_first_to_score");
  if (firstToScore?.length) {
    gameLines.push(
      buildList("first_to_score", "soccer_first_to_score", firstToScore, undefined, hint),
    );
  }
  const teamTotals = byType.get("soccer_team_totals");
  if (teamTotals?.length) {
    gameLines.push(buildTotalsList("team_totals", "soccer_team_totals", teamTotals, hint));
  }

  const exactScore: MarketGroup[] = [];
  const exact = byType.get("soccer_exact_score");
  if (exact?.length) {
    exactScore.push(buildList("exact_score", "soccer_exact_score", exact, undefined, hint));
  }

  const halftime: MarketGroup[] = [];
  const ht = byType.get("soccer_halftime_result");
  if (ht?.length) {
    halftime.push(buildList("halftime", "soccer_halftime_result", ht, undefined, hint));
  }
  const firstHalfBTTS = byType.get("both_teams_to_score_first_half");
  if (firstHalfBTTS?.length) {
    halftime.push(
      buildSingle(
        "btts_first_half",
        "both_teams_to_score_first_half",
        firstHalfBTTS,
        hint,
      ),
    );
  }
  const firstHalfTotals = byType.get("first_half_totals");
  if (firstHalfTotals?.length) {
    halftime.push(
      buildTotalsList("first_half_totals", "first_half_totals", firstHalfTotals, hint),
    );
  }
  const firstHalfTeamTotals = byType.get("soccer_first_half_team_totals");
  if (firstHalfTeamTotals?.length) {
    halftime.push(
      buildTotalsList(
        "first_half_team_totals",
        "soccer_first_half_team_totals",
        firstHalfTeamTotals,
        hint,
      ),
    );
  }

  const secondHalf = buildTypedLists(
    "second_half",
    ["soccer_second_half_result"],
    byType,
    undefined,
    hint,
  );
  const secondHalfBTTS = byType.get("both_teams_to_score_second_half");
  if (secondHalfBTTS?.length) {
    secondHalf.push(
      buildSingle(
        "btts_second_half",
        "both_teams_to_score_second_half",
        secondHalfBTTS,
        hint,
      ),
    );
  }
  const secondHalfTotals = byType.get("second_half_totals");
  if (secondHalfTotals?.length) {
    secondHalf.push(
      buildTotalsList("second_half_totals", "second_half_totals", secondHalfTotals, hint),
    );
  }
  const secondHalfTeamTotals = byType.get("soccer_second_half_team_totals");
  if (secondHalfTeamTotals?.length) {
    secondHalf.push(
      buildTotalsList(
        "second_half_team_totals",
        "soccer_second_half_team_totals",
        secondHalfTeamTotals,
        hint,
      ),
    );
  }

  const corners: MarketGroup[] = [];
  const secondHalfTotalCorners = byType.get("soccer_second_half_total_corners");
  if (secondHalfTotalCorners?.length) {
    corners.push(
      buildTotalsList(
        "second_half_total_corners",
        "soccer_second_half_total_corners",
        secondHalfTotalCorners,
        hint,
      ),
    );
  }
  const teamTotalCorners = byType.get("soccer_team_total_corners");
  if (teamTotalCorners?.length) {
    corners.push(
      buildTotalsList(
        "team_total_corners",
        "soccer_team_total_corners",
        teamTotalCorners,
        hint,
      ),
    );
  }
  const totalCorners = byType.get("total_corners");
  if (totalCorners?.length) {
    corners.push(
      buildTotalsList("total_corners", "total_corners", totalCorners, hint),
    );
  }
  const cornerOddEven = byType.get("soccer_game_corners_odd_even");
  if (cornerOddEven?.length) {
    corners.push(
      buildSingle(
        "corner_odd_even",
        "soccer_game_corners_odd_even",
        cornerOddEven,
        hint,
      ),
    );
  }
  const firstHalfTotalCorners = byType.get("soccer_first_half_total_corners");
  if (firstHalfTotalCorners?.length) {
    corners.push(
      buildTotalsList(
        "first_half_total_corners",
        "soccer_first_half_total_corners",
        firstHalfTotalCorners,
        hint,
      ),
    );
  }

  const goals = buildTypedLists(
    "goals",
    ["soccer_player_goals", "soccer_player_goals_plus_assists"],
    byType,
    undefined,
    hint,
  );
  const assists = buildTypedLists(
    "assists",
    ["soccer_player_assists"],
    byType,
    undefined,
    hint,
  );
  const shots = buildTypedLists(
    "shots",
    ["soccer_player_shots", "soccer_player_shots_on_target"],
    byType,
    undefined,
    hint,
  );
  const saves = buildTypedLists(
    "saves",
    ["soccer_player_goalkeeper_saves"],
    byType,
    undefined,
    hint,
  );

  const categorizedGroups = [
    ...gameLines,
    ...exactScore,
    ...halftime,
    ...secondHalf,
    ...corners,
    ...goals,
    ...assists,
    ...shots,
    ...saves,
  ];
  const categorizedSlugs = new Set(
    categorizedGroups.flatMap((group) =>
      group.options.map((option) => option.market.slug),
    ),
  );
  const uncategorizedMarkets = markets.filter(
    (market) => !categorizedSlugs.has(market.slug),
  );
  const other = uncategorizedMarkets.length
    ? [buildList("other", "other", uncategorizedMarkets, "other", hint)]
    : [];

  return {
    gameLines,
    exactScore,
    halftime,
    secondHalf,
    corners,
    goals,
    assists,
    shots,
    saves,
    other,
  };
}

/** All groups flattened, in category order, for lookups. */
export function allGroups(cats: CategorizedMarkets): MarketGroup[] {
  return [
    ...cats.gameLines,
    ...cats.exactScore,
    ...cats.halftime,
    ...cats.secondHalf,
    ...cats.corners,
    ...cats.goals,
    ...cats.assists,
    ...cats.shots,
    ...cats.saves,
    ...cats.other,
  ];
}

/** Locate the group + option owning a market slug. */
export function findSelection(
  cats: CategorizedMarkets,
  slug: string,
  outcome: "yes" | "no" = "yes",
): { group: MarketGroup; option: MarketOption } | undefined {
  for (const group of allGroups(cats)) {
    const option = group.options.find(
      (o) => o.market.slug === slug && (o.outcome ?? "yes") === outcome,
    ) ?? group.options.find((o) => o.market.slug === slug);
    if (option) return { group, option };
  }
  return undefined;
}

/** First open market across categories (default selection). */
export function defaultSelection(
  cats: CategorizedMarkets,
): { group: MarketGroup; option: MarketOption } | undefined {
  for (const group of allGroups(cats)) {
    const open = group.options.find((o) => o.market.status === "open");
    if (open) return { group, option: open };
    if (group.options[0]) return { group, option: group.options[0] };
  }
  return undefined;
}

/** Category a group belongs to (for syncing the panel's active tab). */
export function categoryOfGroup(
  cats: CategorizedMarkets,
  group: MarketGroup,
): MarketCategory {
  if (cats.exactScore.includes(group)) return "exactScore";
  if (cats.halftime.includes(group)) return "halftime";
  if (cats.secondHalf.includes(group)) return "secondHalf";
  if (cats.corners.includes(group)) return "corners";
  if (cats.goals.includes(group)) return "goals";
  if (cats.assists.includes(group)) return "assists";
  if (cats.shots.includes(group)) return "shots";
  if (cats.saves.includes(group)) return "saves";
  if (cats.other.includes(group)) return "other";
  return "gameLines";
}
