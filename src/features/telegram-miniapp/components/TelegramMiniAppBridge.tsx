"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorldcupMatches } from "src/features/worldcup/data/queries";
import { storeInviteCode } from "src/features/referral/storage";
import {
  readTelegramMiniAppContext,
  readyTelegramWebApp,
} from "../launchParams";
import { parseStartParam, toQueryOutcome } from "../startParam";
import type { ParsedStartParam } from "../types";

const CONSUMED_PREFIX = "telegram_start_param_consumed:";

function consumedKey(startParam: string): string {
  return `${CONSUMED_PREFIX}${startParam}`;
}

function isConsumed(startParam: string): boolean {
  try {
    return window.sessionStorage.getItem(consumedKey(startParam)) === "1";
  } catch {
    return false;
  }
}

function markConsumed(startParam: string): void {
  try {
    window.sessionStorage.setItem(consumedKey(startParam), "1");
  } catch {
    // sessionStorage can be unavailable in restricted browser modes.
  }
}

function detailHref(slug: string, parsed: ParsedStartParam): string {
  if (!parsed.market || !parsed.outcome) return `/world-cup/match/${slug}`;
  const params = new URLSearchParams({
    market: parsed.market,
    outcome: toQueryOutcome(parsed.outcome),
  });
  return `/world-cup/match/${slug}?${params.toString()}`;
}

export function TelegramMiniAppBridge() {
  const router = useRouter();
  const [pending, setPending] = useState<{
    raw: string;
    parsed: ParsedStartParam;
  } | null>(null);

  const needsMatchLookup = pending?.parsed.route === "wd";
  const {
    data: matches = [],
    isFetched,
    isError,
  } = useWorldcupMatches({ enabled: Boolean(needsMatchLookup) });

  useEffect(() => {
    readyTelegramWebApp();

    const context = readTelegramMiniAppContext();
    if (!context?.startParam) return;
    if (isConsumed(context.startParam)) return;

    const parsed = parseStartParam(context.startParam);
    if (!parsed) return;

    if (parsed.referral) {
      storeInviteCode(parsed.referral);
    }

    if (parsed.route === "wl") {
      markConsumed(context.startParam);
      router.replace(`/world-cup?match=${encodeURIComponent(parsed.target)}`);
      return;
    }

    setPending({ raw: context.startParam, parsed });
  }, [router]);

  const targetMatch = useMemo(() => {
    if (!pending) return null;
    return matches.find((m) => m.matchId === pending.parsed.target) ?? null;
  }, [matches, pending]);

  useEffect(() => {
    if (!pending) return;

    if (targetMatch) {
      markConsumed(pending.raw);
      router.replace(detailHref(targetMatch.slug, pending.parsed));
      setPending(null);
      return;
    }

    if (isFetched || isError) {
      markConsumed(pending.raw);
      router.replace(`/world-cup?match=${encodeURIComponent(pending.parsed.target)}`);
      setPending(null);
    }
  }, [isError, isFetched, pending, router, targetMatch]);

  return null;
}
