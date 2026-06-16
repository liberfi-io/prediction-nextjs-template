import type { ParsedStartParam, TelegramStartOutcome } from "./types";

const START_PARAM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TARGET_RE = /^[A-Za-z0-9_]+$/;
const REFERRAL_RE = /^[A-Za-z0-9_]+$/;
const CHAT_ID_RE = /^g[0-9A-Za-z]+$/;
const MARKET_RE = /^(?:mlh|mld|mla|sp|to|to[0-9]+|btts)$/;
const OUTCOME_RE = /^[yn]$/;
const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

interface ParsedStartParamSuffix {
  tgChatId: number | null;
  referral: string | null;
}

function parseReferral(segment: string): string | null {
  if (!segment.startsWith("r")) return null;
  const referral = segment.slice(1);
  if (!referral || !REFERRAL_RE.test(referral)) return null;
  return referral;
}

function parseTelegramChatId(segment: string): number | null {
  if (!CHAT_ID_RE.test(segment)) return null;

  let value = 0n;
  for (const char of segment.slice(1)) {
    const digit = BASE62_ALPHABET.indexOf(char);
    if (digit < 0) return null;
    value = value * 62n + BigInt(digit);
  }

  if (value <= 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return -Number(value);
}

function parseSuffix(parts: string[], startIndex: number): ParsedStartParamSuffix | null {
  let cursor = startIndex;
  let tgChatId: number | null = null;
  let referral: string | null = null;

  if (parts[cursor]?.startsWith("g")) {
    tgChatId = parseTelegramChatId(parts[cursor]);
    if (!tgChatId) return null;
    cursor += 1;
  }

  if (parts[cursor]?.startsWith("r")) {
    referral = parseReferral(parts[cursor]);
    if (!referral) return null;
    cursor += 1;
  }

  return cursor === parts.length ? { tgChatId, referral } : null;
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
    const suffix = parseSuffix(parts, 3);
    if (!suffix) return null;
    return {
      version: "v1",
      route,
      target,
      market: null,
      outcome: null,
      tgChatId: suffix.tgChatId,
      referral: suffix.referral,
    };
  }

  if (parts.length >= 5) {
    const selection = parseMarketOutcome(parts[3], parts[4]);
    if (selection) {
      const suffix = parseSuffix(parts, 5);
      if (!suffix) return null;
      return {
        version: "v1",
        route,
        target,
        market: selection.market,
        outcome: selection.outcome,
        tgChatId: suffix.tgChatId,
        referral: suffix.referral,
      };
    }
  }

  {
    const suffix = parseSuffix(parts, 3);
    if (!suffix) return null;
    return {
      version: "v1",
      route,
      target,
      market: null,
      outcome: null,
      tgChatId: suffix.tgChatId,
      referral: suffix.referral,
    };
  }
}

export function toQueryOutcome(outcome: TelegramStartOutcome): "yes" | "no" {
  return outcome === "y" ? "yes" : "no";
}
