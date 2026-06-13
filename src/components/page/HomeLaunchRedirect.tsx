"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@liberfi.io/ui";
import { useWorldcupMatches } from "src/features/worldcup/data/queries";
import { matchSlugById } from "src/features/worldcup/data/schedule";
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

// Hard ceiling for the `wd` matchId→slug lookup. The splash must never hang on
// a stalled matches request — observed on iOS/macOS WebKit, where a request can
// sit pending indefinitely (neither resolving nor erroring). When this fires we
// give up on the slug and fall back to the list anchored on the match id.
const WD_LOOKUP_TIMEOUT_MS = 2500;

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

    // `wd`: the matchId→slug mapping is fixed for group matches, so resolve it
    // from the static schedule and jump straight to the detail page with zero
    // network. This is the common deep-link case and avoids fetching the whole
    // matches list on `/` (the original cause of the WebKit "spinner forever").
    const staticSlug = matchSlugById(parsed.target);
    if (staticSlug) {
      diagMark("redirect:wd-static");
      diagReport("redirect");
      router.replace(detailHref(staticSlug, parsed));
      return;
    }

    // Unknown id (e.g. a knockout fixture not yet resolved): fall back to the
    // live matches lookup, bounded by the timeout safety net below.
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
      return;
    }

    // Still loading: arm a hard timeout so a stalled request can't trap the
    // splash forever. If the lookup resolves first, the effect re-runs and one
    // of the branches above clears this timer.
    const timer = setTimeout(() => {
      diagMark("redirect:wd-timeout");
      diagReport("redirect");
      router.replace(listHref(pending.target));
    }, WD_LOOKUP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isError, isFetched, pending, router, targetMatch]);

  return <LaunchSplash />;
}
