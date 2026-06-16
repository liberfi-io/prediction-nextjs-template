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
  const corrected = correctedYesAsk(m);
  if (corrected !== undefined) return corrected;
  return m.outcomes?.[0]?.best_ask ?? m.outcomes?.[0]?.price ?? 0;
}

/** Strip the trailing " (...)" qualifier Polymarket appends to group titles. */
function cleanTitle(raw: string): string {
  const idx = raw.indexOf(" (");
  return (idx > 0 ? raw.slice(0, idx) : raw).trim();
}

/** Best human label for a market: cleaned group title, else question. */
function marketLabel(m: PredictMarket): string {
  return cleanTitle(groupItemTitle(m)) || m.question || m.slug;
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

function buildMoneyline(markets: PredictMarket[]): MarketGroup {
  // Keep ingestion order (home / draw / away) for a stable selector layout.
  const options = markets.map(
    (m, i): MarketOption => ({ market: m, label: marketLabel(m), sort: i }),
  );
  return {
    key: "moneyline",
    type: "moneyline",
    type_label: "moneyline",
    options,
    volume: sumVolume(markets),
  };
}

function buildSpreads(markets: PredictMarket[], hint?: TeamHint): MarketGroup {
  const options = markets
    .map((m): MarketOption => {
      const line = marketLine(m) ?? 0;
      const homeLine = spreadFavoursHome(m, hint) ? line : -line;
      return { market: m, label: formatLine(homeLine), sort: homeLine };
    })
    .sort((a, b) => a.sort - b.sort);
  return {
    key: "spreads",
    type: "spreads",
    type_label: "spreads",
    options,
    volume: sumVolume(markets),
  };
}

function buildTotals(markets: PredictMarket[]): MarketGroup {
  const options = markets
    .map((m): MarketOption => {
      const line = marketLine(m) ?? 0;
      return { market: m, label: formatLine(line, false), sort: line };
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
): MarketGroup {
  const options = markets
    .map((m): MarketOption => {
      const line = marketLine(m);
      return {
        market: m,
        label: marketLabel(m),
        sort: line ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  return { key, type, type_label: type, options, volume: sumVolume(markets) };
}

/** A single binary market (e.g. Both Teams to Score) → one-option group. */
function buildSingle(
  key: string,
  type: SportsMarketType,
  markets: PredictMarket[],
): MarketGroup {
  return {
    key,
    type,
    type_label: type,
    options: markets.map((m, i) => ({ market: m, label: marketLabel(m), sort: i })),
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
): MarketGroup {
  // Exact-score options carry an "Exact Score: " prefix (e.g.
  // "Exact Score: 2-0"); drop it so only the scoreline shows everywhere it is
  // surfaced (panel buttons, chart legend, trade form title).
  const stripPrefix = type === "soccer_exact_score";
  const options = markets
    .map((m): MarketOption => {
      const raw = marketLabel(m);
      return {
        market: m,
        label: stripPrefix ? stripLabelPrefix(raw) : raw,
        sort: yesPrice(m),
      };
    })
    .sort((a, b) => b.sort - a.sort);
  return { key, type, type_label: typeLabel, options, volume: sumVolume(markets) };
}

function buildTypedLists(
  prefix: string,
  types: SportsMarketType[],
  byType: Map<SportsMarketType, PredictMarket[]>,
  typeLabel?: SportsMarketType,
): MarketGroup[] {
  const groups: MarketGroup[] = [];
  for (const type of types) {
    const markets = byType.get(type);
    if (markets?.length) groups.push(buildList(`${prefix}:${type}`, type, markets, typeLabel));
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
  const moneyline = byType.get("moneyline");
  if (moneyline?.length) gameLines.push(buildMoneyline(moneyline));
  const btts = byType.get("both_teams_to_score");
  if (btts?.length) gameLines.push(buildSingle("btts", "both_teams_to_score", btts));
  const spreads = byType.get("spreads");
  if (spreads?.length) gameLines.push(buildSpreads(spreads, hint));
  const totals = byType.get("totals");
  if (totals?.length) gameLines.push(buildTotals(totals));
  const firstToScore = byType.get("soccer_first_to_score");
  if (firstToScore?.length) {
    gameLines.push(buildList("first_to_score", "soccer_first_to_score", firstToScore));
  }
  const teamTotals = byType.get("soccer_team_totals");
  if (teamTotals?.length) {
    gameLines.push(buildTotalsList("team_totals", "soccer_team_totals", teamTotals));
  }

  const exactScore: MarketGroup[] = [];
  const exact = byType.get("soccer_exact_score");
  if (exact?.length) exactScore.push(buildList("exact_score", "soccer_exact_score", exact));

  const halftime: MarketGroup[] = [];
  const ht = byType.get("soccer_halftime_result");
  if (ht?.length) halftime.push(buildList("halftime", "soccer_halftime_result", ht));
  const firstHalfBTTS = byType.get("both_teams_to_score_first_half");
  if (firstHalfBTTS?.length) {
    halftime.push(
      buildSingle(
        "btts_first_half",
        "both_teams_to_score_first_half",
        firstHalfBTTS,
      ),
    );
  }
  const firstHalfTotals = byType.get("first_half_totals");
  if (firstHalfTotals?.length) {
    halftime.push(
      buildTotalsList("first_half_totals", "first_half_totals", firstHalfTotals),
    );
  }
  const firstHalfTeamTotals = byType.get("soccer_first_half_team_totals");
  if (firstHalfTeamTotals?.length) {
    halftime.push(
      buildTotalsList(
        "first_half_team_totals",
        "soccer_first_half_team_totals",
        firstHalfTeamTotals,
      ),
    );
  }

  const secondHalf = buildTypedLists("second_half", ["soccer_second_half_result"], byType);
  const secondHalfBTTS = byType.get("both_teams_to_score_second_half");
  if (secondHalfBTTS?.length) {
    secondHalf.push(
      buildSingle(
        "btts_second_half",
        "both_teams_to_score_second_half",
        secondHalfBTTS,
      ),
    );
  }
  const secondHalfTotals = byType.get("second_half_totals");
  if (secondHalfTotals?.length) {
    secondHalf.push(
      buildTotalsList("second_half_totals", "second_half_totals", secondHalfTotals),
    );
  }
  const secondHalfTeamTotals = byType.get("soccer_second_half_team_totals");
  if (secondHalfTeamTotals?.length) {
    secondHalf.push(
      buildTotalsList(
        "second_half_team_totals",
        "soccer_second_half_team_totals",
        secondHalfTeamTotals,
      ),
    );
  }

  const corners = buildTypedLists(
    "corners",
    [
      "soccer_second_half_total_corners",
      "soccer_team_total_corners",
      "total_corners",
      "soccer_game_corners_odd_even",
      "soccer_first_half_total_corners",
      "soccer_first_corner",
    ],
    byType,
  );

  const goals = buildTypedLists(
    "goals",
    ["soccer_player_goals", "soccer_player_goals_plus_assists"],
    byType,
  );
  const assists = buildTypedLists("assists", ["soccer_player_assists"], byType);
  const shots = buildTypedLists(
    "shots",
    ["soccer_player_shots", "soccer_player_shots_on_target"],
    byType,
  );
  const saves = buildTypedLists(
    "saves",
    ["soccer_player_goalkeeper_saves"],
    byType,
  );

  const knownTypes = new Set<SportsMarketType>([
    "moneyline",
    "both_teams_to_score",
    "spreads",
    "totals",
    "soccer_first_to_score",
    "soccer_team_totals",
    "soccer_exact_score",
    "soccer_halftime_result",
    "both_teams_to_score_first_half",
    "both_teams_to_score_second_half",
    "first_half_totals",
    "second_half_totals",
    "soccer_first_half_team_totals",
    "soccer_second_half_team_totals",
    "soccer_second_half_result",
    "soccer_second_half_total_corners",
    "soccer_team_total_corners",
    "total_corners",
    "soccer_game_corners_odd_even",
    "soccer_first_half_total_corners",
    "soccer_first_corner",
    "soccer_player_goals",
    "soccer_player_goals_plus_assists",
    "soccer_player_assists",
    "soccer_player_shots",
    "soccer_player_shots_on_target",
    "soccer_player_goalkeeper_saves",
  ]);
  const otherMarkets = markets.filter((m) => !knownTypes.has(sportsType(m)));
  const other = otherMarkets.length
    ? [buildList("other", "other", otherMarkets)]
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
): { group: MarketGroup; option: MarketOption } | undefined {
  for (const group of allGroups(cats)) {
    const option = group.options.find((o) => o.market.slug === slug);
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
