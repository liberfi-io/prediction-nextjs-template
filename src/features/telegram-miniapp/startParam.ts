import type { ParsedStartParam, TelegramStartOutcome } from "./types";

const START_PARAM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TARGET_RE = /^[A-Za-z0-9_]+$/;
const REFERRAL_RE = /^[A-Za-z0-9_]+$/;
const CHAT_ID_RE = /^g[0-9A-Za-z]+$/;
const OPERATOR_RE = /^o[0-9A-Za-z]+$/;
const MARKET_RE = /^(?:mlh|mld|mla|sp|to|to[0-9]+|btts)$/;
const OUTCOME_RE = /^[yn]$/;
const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const EMPTY_PARSED_START_PARAM: ParsedStartParam = {
  version: "v1",
  route: null,
  target: null,
  market: null,
  outcome: null,
  tgChatId: null,
  tgChatType: null,
  referral: null,
  operatorSegment: null,
};

function parseReferral(segment: string): string | null {
  if (!segment.startsWith("r")) return null;
  const referral = segment.slice(1);
  if (!referral || !REFERRAL_RE.test(referral)) return null;
  return referral;
}

function parseBareReferral(segment: string): string | null {
  return REFERRAL_RE.test(segment) ? segment : null;
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

function parseOperatorSegment(segment: string): string | null {
  if (!OPERATOR_RE.test(segment)) return null;
  return segment;
}

function inferTelegramChatType(tgChatId: number): string {
  return String(tgChatId).startsWith("-100") ? "supergroup" : "group";
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
  if (parts.length === 1) return null;

  const parsed: ParsedStartParam = { ...EMPTY_PARSED_START_PARAM };
  let cursor = 1;

  while (cursor < parts.length) {
    const segment = parts[cursor];

    if (segment === "wl" || segment === "wd") {
      if (parsed.route) return null;
      const target = parts[cursor + 1];
      if (!target || !TARGET_RE.test(target)) return null;

      parsed.route = segment;
      parsed.target = target;
      cursor += 2;

      if (segment === "wd" && cursor + 1 < parts.length) {
        const selection = parseMarketOutcome(parts[cursor], parts[cursor + 1]);
        if (selection) {
          parsed.market = selection.market;
          parsed.outcome = selection.outcome;
          cursor += 2;
        }
      }
      continue;
    }

    if (segment.startsWith("g")) {
      if (parsed.tgChatId) return null;
      const tgChatId = parseTelegramChatId(segment);
      if (!tgChatId) return null;
      parsed.tgChatId = tgChatId;
      parsed.tgChatType = inferTelegramChatType(tgChatId);
      cursor += 1;
      continue;
    }

    if (segment.startsWith("r")) {
      if (parsed.referral) return null;
      const referral = parseReferral(segment);
      if (!referral) return null;
      parsed.referral = referral;
      cursor += 1;
      continue;
    }

    if (segment.startsWith("o")) {
      if (parsed.operatorSegment) return null;
      const operatorSegment = parseOperatorSegment(segment);
      if (operatorSegment) {
        parsed.operatorSegment = operatorSegment;
      }
      cursor += 1;
      continue;
    }

    if (parts.length === 2 && cursor === 1) {
      const referral = parseBareReferral(segment);
      if (!referral) return null;
      parsed.referral = referral;
      cursor += 1;
      continue;
    }

    cursor += 1;
  }

  return parsed;
}

export function toQueryOutcome(outcome: TelegramStartOutcome): "yes" | "no" {
  return outcome === "y" ? "yes" : "no";
}
