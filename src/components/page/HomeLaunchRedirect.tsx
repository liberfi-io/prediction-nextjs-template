"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@liberfi.io/ui";
import { useWorldcupMatches } from "src/features/worldcup/data/queries";
import { storeInviteCode } from "src/features/referral/storage";
import {
  readTelegramMiniAppContext,
  readyTelegramWebApp,
} from "src/features/telegram-miniapp/launchParams";
import {
  parseStartParam,
  toQueryOutcome,
} from "src/features/telegram-miniapp/startParam";
import type { ParsedStartParam } from "src/features/telegram-miniapp/types";
import { diagMark, diagReport } from "src/features/diagnostics/clientDiag";

/**
 * Where a launch with no (or unparseable) deep link lands. The home route is a
 * pure redirector — it never renders a list itself — so both plain web visitors
 * and generic Telegram launches end up on the World Cup hub.
 */
const DEFAULT_HREF = "/world-cup";

function detailHref(slug: string, parsed: ParsedStartParam): string {
  if (!parsed.market || !parsed.outcome) return `/world-cup/match/${slug}`;
  const params = new URLSearchParams({
    market: parsed.market,
    outcome: toQueryOutcome(parsed.outcome),
  });
  return `/world-cup/match/${slug}?${params.toString()}`;
}

function listHref(target: string): string {
  return `/world-cup?match=${encodeURIComponent(target)}`;
}

function LaunchSplash() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0b]">
      <Spinner size="md" />
    </div>
  );
}

/**
 * Client splash rendered at `/`. Telegram delivers `start_param` only in the
 * client-side URL hash / `initData`, so the server can never know the deep-link
 * target — resolution must happen here, after mount. We parse the start param,
 * capture any referral, then `router.replace` to the real destination so the
 * home entry is swapped out of history (no back-button trap, no list flash).
 *
 * `wd` (match detail) needs a matchId→slug lookup; the matches list is
 * SSR-prefetched by the home page so this usually resolves from cache instantly.
 */
export function HomeLaunchRedirect() {
  const router = useRouter();
  const [pending, setPending] = useState<ParsedStartParam | null>(null);

  const needsMatchLookup = pending?.route === "wd";
  const {
    data: matches = [],
    isFetched,
    isError,
  } = useWorldcupMatches({ enabled: Boolean(needsMatchLookup) });

  useEffect(() => {
    diagMark("home_effect");
    readyTelegramWebApp();

    const context = readTelegramMiniAppContext();
    const parsed = context?.startParam
      ? parseStartParam(context.startParam)
      : null;
    diagMark(
      `tg_ctx:${context ? "ctx" : "none"}:route=${parsed?.route ?? "-"}`,
    );

    if (parsed?.referral) {
      storeInviteCode(parsed.referral);
    }

    if (!parsed) {
      diagMark(`redirect:${DEFAULT_HREF}`);
      diagReport("redirect");
      router.replace(DEFAULT_HREF);
      return;
    }

    if (parsed.route === "wl") {
      diagMark("redirect:wl");
      diagReport("redirect");
      router.replace(listHref(parsed.target));
      return;
    }

    // `wd`: defer until the matches lookup resolves the matchId→slug.
    diagMark("pending:wd");
    setPending(parsed);
  }, [router]);

  const targetMatch = useMemo(() => {
    if (!pending) return null;
    return matches.find((m) => m.matchId === pending.target) ?? null;
  }, [matches, pending]);

  useEffect(() => {
    if (!pending) return;

    if (targetMatch) {
      diagMark("redirect:wd-detail");
      diagReport("redirect");
      router.replace(detailHref(targetMatch.slug, pending));
      return;
    }

    // Lookup finished without a match (hidden / unknown id, or backend down):
    // fall back to the list anchored on the requested match id.
    if (isFetched || isError) {
      diagMark(`redirect:wd-fallback:${isError ? "err" : "ok"}`);
      diagReport("redirect");
      router.replace(listHref(pending.target));
    }
  }, [isError, isFetched, pending, router, targetMatch]);

  return <LaunchSplash />;
}
