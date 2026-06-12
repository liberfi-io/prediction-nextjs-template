import type { ParsedStartParam, TelegramStartOutcome } from "./types";

const START_PARAM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TARGET_RE = /^[A-Za-z0-9_]+$/;
const REFERRAL_RE = /^[A-Za-z0-9_]+$/;
const MARKET_RE = /^(?:mlh|mld|mla|sp|to|to[0-9]+|btts)$/;
const OUTCOME_RE = /^[yn]$/;

function parseReferral(segment: string): string | null {
  if (!segment.startsWith("r")) return null;
  const referral = segment.slice(1);
  if (!referral || !REFERRAL_RE.test(referral)) return null;
  return referral;
}

function isOutcome(value: string): value is TelegramStartOutcome {
  return OUTCOME_RE.test(value);
}

function parseMarketOutcome(
  market: string,
  outcome: string,
): Pick<ParsedStartParam, "market" | "outcome"> | null {
  if (!MARKET_RE.test(market)) return null;
  if (!isOutcome(outcome)) return null;
  return { market, outcome };
}

export function parseStartParam(value: string): ParsedStartParam | null {
  const raw = value.trim();
  if (!START_PARAM_RE.test(raw)) return null;

  const parts = raw.split("-");
  if (parts[0] !== "v1") return null;

  const route = parts[1];
  const target = parts[2];
  if ((route !== "wl" && route !== "wd") || !target || !TARGET_RE.test(target)) {
    return null;
  }

  if (route === "wl") {
    if (parts.length === 3) {
      return { version: "v1", route, target, market: null, outcome: null, referral: null };
    }
    if (parts.length === 4) {
      const referral = parseReferral(parts[3]);
      if (!referral) return null;
      return { version: "v1", route, target, market: null, outcome: null, referral };
    }
    return null;
  }

  if (parts.length === 3) {
    return { version: "v1", route, target, market: null, outcome: null, referral: null };
  }

  if (parts.length === 4) {
    const referral = parseReferral(parts[3]);
    if (!referral) return null;
    return { version: "v1", route, target, market: null, outcome: null, referral };
  }

  if (parts.length === 5 || parts.length === 6) {
    const selection = parseMarketOutcome(parts[3], parts[4]);
    if (!selection) return null;
    const referral = parts.length === 6 ? parseReferral(parts[5]) : null;
    if (parts.length === 6 && !referral) return null;
    return {
      version: "v1",
      route,
      target,
      market: selection.market,
      outcome: selection.outcome,
      referral,
    };
  }

  return null;
}

export function toQueryOutcome(outcome: TelegramStartOutcome): "yes" | "no" {
  return outcome === "y" ? "yes" : "no";
}
