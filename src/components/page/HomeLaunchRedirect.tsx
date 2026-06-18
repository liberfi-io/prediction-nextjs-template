"use client";

import { useEffect, useMemo, useState } from "react";
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
  if (!parsed.market || !parsed.outcome) return `/event/${slug}`;
  const params = new URLSearchParams({
    market: parsed.market,
    outcome: toQueryOutcome(parsed.outcome),
  });
  return `/event/${slug}?${params.toString()}`;
}

function listHref(target: string): string {
  return `/world-cup?match=${encodeURIComponent(target)}`;
}

/**
 * Carry the Telegram launch hash (`#tgWebAppData=...`) across the redirect.
 *
 * Telegram delivers the mini-app launch payload — including the `initData`
 * that Privy needs for silent Telegram login — only in the URL hash. Privy
 * reads `window.location.hash` directly and bails unless it still starts with
 * `#tgWebAppData`. Navigating to a hash-less URL before Privy consumes it would
 * silently kill auto-login, so we append the original launch hash; Privy clears
 * it itself once login completes. Routing ignores the hash, so this is inert
 * for navigation.
 */
function withLaunchHash(href: string): string {
  if (typeof window === "undefined") return href;
  if (href.includes("#")) return href;
  const hash = window.location.hash;
  return hash.startsWith("#tgWebAppData") ? `${href}${hash}` : href;
}

/**
 * Leave the launch splash with a full-document navigation.
 *
 * `/` is a throwaway redirect splash. Next's client navigation
 * (`router.replace`) is fragile here in the Telegram in-app WebView: it is a
 * low-priority React transition that must run on the main thread before it even
 * issues the destination's RSC request. On cold start Privy's login burst
 * (parsing/executing the auth.privy.io bundles, the embedded-wallet iframe
 * postMessage round-trips, WalletConnect init) keeps the main thread busy, so
 * that transition gets starved indefinitely — the RSC request is never sent and
 * the splash spinner hangs forever (a refresh clears it: the session already
 * exists, so there is no login burst, and the target renders via SSR). A hard
 * `location.replace` is a native synchronous navigation that bypasses React
 * scheduling entirely, so it always fires.
 */
function redirectTo(href: string): void {
  window.location.replace(withLaunchHash(href));
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
 * capture any referral, then hard-redirect (`location.replace`) to the real
 * destination so the home entry is swapped out of history (no back-button trap,
 * no list flash) and the target renders via SSR instead of a contended RSC
 * fetch (see {@link redirectTo}).
 *
 * `wd` (match detail) usually resolves its matchId→slug from the static
 * schedule with zero network; only unknown ids fall back to a live lookup.
 */
export function HomeLaunchRedirect() {
  const [pending, setPending] = useState<ParsedStartParam | null>(null);

  const needsMatchLookup = pending?.route === "wd";
  const {
    data: matches = [],
    isFetched,
    isError,
  } = useWorldcupMatches({ enabled: Boolean(needsMatchLookup) });

  useEffect(() => {
    readyTelegramWebApp();

    const context = readTelegramMiniAppContext();
    const parsed = context?.startParam
      ? parseStartParam(context.startParam)
      : null;

    if (parsed?.referral) {
      storeInviteCode(parsed.referral);
    }

    if (!parsed) {
      redirectTo(DEFAULT_HREF);
      return;
    }

    if (!parsed.route) {
      redirectTo(DEFAULT_HREF);
      return;
    }

    if (parsed.route === "wl" && parsed.target) {
      redirectTo(listHref(parsed.target));
      return;
    }

    // `wd`: the matchId→slug mapping is fixed for group matches, so resolve it
    // from the static schedule and jump straight to the detail page with zero
    // network. This is the common deep-link case and avoids fetching the whole
    // matches list on `/` (the original cause of the WebKit "spinner forever").
    if (!parsed.target) {
      redirectTo(DEFAULT_HREF);
      return;
    }

    const staticSlug = matchSlugById(parsed.target);
    if (staticSlug) {
      redirectTo(detailHref(staticSlug, parsed));
      return;
    }

    // Unknown id (e.g. a knockout fixture not yet resolved): fall back to the
    // live matches lookup, bounded by the timeout safety net below.
    setPending(parsed);
  }, []);

  const targetMatch = useMemo(() => {
    if (!pending) return null;
    return matches.find((m) => m.matchId === pending.target) ?? null;
  }, [matches, pending]);

  useEffect(() => {
    if (!pending) return;
    const target = pending.target;
    if (!target) {
      redirectTo(DEFAULT_HREF);
      return;
    }

    if (targetMatch) {
      redirectTo(detailHref(targetMatch.slug, pending));
      return;
    }

    // Lookup finished without a match (hidden / unknown id, or backend down):
    // fall back to the list anchored on the requested match id.
    if (isFetched || isError) {
      redirectTo(listHref(target));
      return;
    }

    // Still loading: arm a hard timeout so a stalled request can't trap the
    // splash forever. If the lookup resolves first, the effect re-runs and one
    // of the branches above clears this timer.
    const timer = setTimeout(() => {
      redirectTo(listHref(target));
    }, WD_LOOKUP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isError, isFetched, pending, targetMatch]);

  return <LaunchSplash />;
}
