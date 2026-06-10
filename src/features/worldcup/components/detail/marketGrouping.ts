/**
 * Groups a World Cup match's full market set (returned by
 * `GET /api/v1/worldcup/matches/{slug}`) into the categories and selectable
 * groups the Markets panel renders. Replicates future.news' market switcher:
 *
 *   Game Lines      = moneyline + both_teams_to_score + spreads + totals
 *   Exact Score     = soccer_exact_score
 *   Halftime Result = soccer_halftime_result
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
  | "other";

export type MarketCategory = "gameLines" | "exactScore" | "halftime";

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

/** YES (primary) outcome probability in [0,1]. */
export function yesPrice(m: PredictMarket): number {
  return m.outcomes?.[0]?.price ?? m.outcomes?.[0]?.best_ask ?? 0;
}

/**
 * YES (primary) outcome best ask in [0,1] — the price you pay to buy a YES
 * share. Used for the Markets panel's displayed price so it lines up with the
 * order book's best-ask line (the static snapshot; the live order book is
 * layered on top for the selected market).
 */
export function yesAskPrice(m: PredictMarket): number {
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
  return { key, type, type_label: type, options, volume: sumVolume(markets) };
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

  const exactScore: MarketGroup[] = [];
  const exact = byType.get("soccer_exact_score");
  if (exact?.length) exactScore.push(buildList("exact_score", "soccer_exact_score", exact));

  const halftime: MarketGroup[] = [];
  const ht = byType.get("soccer_halftime_result");
  if (ht?.length) halftime.push(buildList("halftime", "soccer_halftime_result", ht));

  return { gameLines, exactScore, halftime };
}

/** All groups flattened, in category order, for lookups. */
export function allGroups(cats: CategorizedMarkets): MarketGroup[] {
  return [...cats.gameLines, ...cats.exactScore, ...cats.halftime];
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
  return "gameLines";
}
