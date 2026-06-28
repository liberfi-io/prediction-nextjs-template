import type { WcMatch } from "../../types";
import {
  allGroups,
  marketLine,
  type CategorizedMarkets,
  type MarketGroup,
} from "./marketGrouping";

export type DeepLinkOutcome = "yes" | "no";

export function normalizeDeepLinkOutcome(
  value: string | null,
): DeepLinkOutcome | null {
  if (value === "yes" || value === "y") return "yes";
  if (value === "no" || value === "n") return "no";
  return null;
}

export function isWorldcupMarketCode(value: string): boolean {
  return (
    value === "mlh" ||
    value === "mld" ||
    value === "mla" ||
    value === "sp" ||
    value === "sph" ||
    value === "spa" ||
    value === "to" ||
    /^to[0-9]+$/.test(value) ||
    value === "btts"
  );
}

function groupOf(cats: CategorizedMarkets, type: MarketGroup["type"]) {
  return allGroups(cats).find((group) => group.type === type);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function teamKeys(match: WcMatch, side: "home" | "away"): Set<string> {
  const team = match[side];
  return new Set(
    [team.code, team.name, team.nameZh]
      .filter(Boolean)
      .map((value) => normalizeText(value)),
  );
}

function optionMatchesAny(label: string, keys: Set<string>): boolean {
  const normalized = normalizeText(label);
  for (const key of keys) {
    if (key && normalized.includes(key)) return true;
  }
  return false;
}

function parseLineCode(code: string): number | null {
  if (!/^[0-9]+$/.test(code)) return null;
  const numeric = Number(code);
  if (!Number.isFinite(numeric)) return null;
  return numeric / 10;
}

function findDefaultOption(group: MarketGroup | undefined) {
  return group?.options.find((o) => o.market.status === "open") ?? group?.options[0] ?? null;
}

function resolveMoneyline(
  cats: CategorizedMarkets,
  match: WcMatch,
  marketCode: string,
) {
  const group = groupOf(cats, "moneyline");
  if (!group) return null;

  if (marketCode === "mld") {
    const byLabel = group.options.find((option) => {
      const label = normalizeText(option.label);
      return label.includes("draw") || label.includes("tie") || label.includes("平");
    });
    return byLabel ?? group.options[1] ?? null;
  }

  const side = marketCode === "mlh" ? "home" : marketCode === "mla" ? "away" : null;
  if (!side) return null;

  const keys = teamKeys(match, side);
  const byLabel = group.options.find((option) => optionMatchesAny(option.label, keys));
  if (byLabel) return byLabel;
  return side === "home" ? group.options[0] ?? null : group.options[2] ?? null;
}

function resolveTotal(cats: CategorizedMarkets, marketCode: string) {
  const group = groupOf(cats, "totals");
  if (!group) return null;
  if (marketCode === "to") return findDefaultOption(group);

  const line = parseLineCode(marketCode.slice(2));
  if (line === null) return null;
  return (
    group.options.find((option) => {
      const value = marketLine(option.market);
      return typeof value === "number" && Math.abs(value - line) < 0.001;
    }) ?? findDefaultOption(group)
  );
}

function resolveSpread(
  cats: CategorizedMarkets,
  match: WcMatch | null | undefined,
  marketCode: string,
  outcome: DeepLinkOutcome,
) {
  const group = groupOf(cats, "spreads");
  if (!group) return null;
  if (marketCode === "sp" || !match) return findDefaultOption(group);

  const targetLine = match.spread.line;
  return (
    group.options.find(
      (option) =>
        Math.abs((option.line ?? Number.NaN) - targetLine) < 0.001 &&
        (option.outcome ?? "yes") === outcome,
    ) ??
    group.options.find((option) => Math.abs((option.line ?? Number.NaN) - targetLine) < 0.001) ??
    findDefaultOption(group)
  );
}

export function resolveMarketDeepLink(input: {
  cats: CategorizedMarkets;
  match: WcMatch | null | undefined;
  marketCode: string | null;
  outcomeCode: string | null;
}): { marketSlug: string; outcome: DeepLinkOutcome } | null {
  const { cats, match, marketCode } = input;
  if (!marketCode) return null;

  const outcome = normalizeDeepLinkOutcome(input.outcomeCode);
  if (!outcome) return null;

  let option:
    | ReturnType<typeof findDefaultOption>
    | ReturnType<typeof resolveMoneyline> = null;

  if (marketCode === "mlh" || marketCode === "mld" || marketCode === "mla") {
    if (!match) return null;
    option = resolveMoneyline(cats, match, marketCode);
  } else if (marketCode === "sp" || marketCode === "sph" || marketCode === "spa") {
    option = resolveSpread(cats, match, marketCode, outcome);
  } else if (marketCode === "to" || /^to[0-9]+$/.test(marketCode)) {
    option = resolveTotal(cats, marketCode);
  } else if (marketCode === "btts") {
    option = findDefaultOption(groupOf(cats, "both_teams_to_score"));
  }

  if (!option) return null;
  return { marketSlug: option.market.slug, outcome };
}
