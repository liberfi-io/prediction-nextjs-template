"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@liberfi.io/ui";
import { useWorldcupMatches } from "src/features/worldcup/data/queries";
import { matchSlugById } from "src/features/worldcup/data/schedule";
import { storeInviteCode } from "src/features/referral/storage";
import {
  isLikelyMpChatLaunch,
  readMpChatMiniAppContext,
} from "src/features/mpchat-miniapp/launchParams";
import {
  getTelegramWebApp,
  isTelegramRecoveryLaunch,
  readTelegramInitData,
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
const MP_START_PARAM_RETRY_MS = 5000;
const MP_START_PARAM_RETRY_INTERVAL_MS = 100;

function sanitizeInitData(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  const params = new URLSearchParams(value);
  return {
    length: value.length,
    keys: Array.from(params.keys()).slice(0, 30),
    start_param: params.get("start_param"),
    startParam: params.get("startParam"),
    startapp: params.get("startapp"),
    auth_date: params.get("auth_date"),
    hasHash: params.has("hash"),
    hasUser: params.has("user"),
    hasChat: params.has("chat"),
  };
}

function safeMiniAppUser(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    id: record.id,
    username: record.username,
    language_code: record.language_code,
    languageCode: record.languageCode,
  };
}

function miniAppSnapshot() {
  if (typeof window === "undefined") return null;
  const telegramWebApp = window.Telegram?.WebApp;
  const mpChatWebApp = window.MpChat?.WebApp;
  const mpChatWebAppRecord = (mpChatWebApp ?? {}) as Record<string, unknown>;
  const mpUnsafe = mpChatWebApp?.initDataUnsafe ?? {};
  const tgUnsafe = telegramWebApp?.initDataUnsafe ?? {};

  return {
    href: window.location.href,
    origin: window.location.origin,
    pathname: window.location.pathname,
    search: window.location.search,
    hashPrefix: window.location.hash.slice(0, 80),
    referrer: document.referrer,
    hasTelegramWebApp: Boolean(telegramWebApp),
    telegram: {
      initSource: telegramWebApp ? "present" : "missing",
      initData: sanitizeInitData(telegramWebApp?.initData),
      unsafeStartParam: tgUnsafe.start_param,
      unsafeChatType: tgUnsafe.chat_type,
      hasUser: Boolean(tgUnsafe.user),
      user: safeMiniAppUser(tgUnsafe.user),
    },
    hasMpChatWebApp: Boolean(mpChatWebApp),
    hasMpChatReady: Boolean(mpChatWebAppRecord.ready),
    hasJSBridge: Boolean(window.JSBridge),
    hasInitWebApp: Boolean(window.initWebApp),
    mpchat: {
      initSource: mpChatWebAppRecord.initSource,
      initError: mpChatWebAppRecord.initError,
      initData: sanitizeInitData(mpChatWebApp?.initData),
      unsafeStartParam: mpUnsafe.start_param,
      unsafeStartParamCamel: mpUnsafe.startParam,
      unsafeStartapp: mpUnsafe.startapp,
      unsafeChatType: mpUnsafe.chat_type ?? mpUnsafe.chatType,
      botId: mpUnsafe.bot_id ?? mpUnsafe.botId,
      nonce: mpUnsafe.nonce,
      hasUser: Boolean(mpUnsafe.user),
      user: safeMiniAppUser(mpUnsafe.user),
    },
  };
}

function reportMiniAppLaunch(stage: string, detail?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const payload = {
    stage,
    detail,
    snapshot: miniAppSnapshot(),
  };

  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/debug/miniapp-launch", blob)) return;
  }

  void fetch("/api/debug/miniapp-launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

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
 * Carry the Mini App launch hash across the redirect.
 *
 * Telegram and MPChat can deliver the launch payload — including the `initData`
 * needed for silent login — in the URL hash. Navigating to a hash-less URL
 * before auth consumes it would silently kill auto-login, so we append the
 * original launch hash. Routing ignores the hash, so this is inert for
 * navigation.
 */
function withLaunchHash(href: string): string {
  if (typeof window === "undefined") return href;
  if (href.includes("#")) return href;
  const hash = window.location.hash;
  return isMiniAppLaunchHash(hash) ? `${href}${hash}` : href;
}

function isMiniAppLaunchHash(hash: string): boolean {
  return (
    hash.startsWith("#tgWebAppData") ||
    hash.startsWith("#mpWebAppData") ||
    hash.startsWith("#mpChatWebAppData")
  );
}

/**
 * Build the `/recovery` destination with a guaranteed `#tgWebAppData=` hash.
 *
 * Privy's seamless Telegram login only fires when `window.location.hash` starts
 * with `#tgWebAppData=` (it never reads `window.Telegram.WebApp.initData`). On
 * iOS Telegram the launch payload arrives through the native bridge into
 * `WebApp.initData`, NOT the URL hash, so a plain redirect lands on a hash-less
 * `/recovery` where seamless never triggers. We reconstruct the canonical hash
 * (`encodeURIComponent(initData)`) here — where `WebApp` is already populated
 * (the recovery start param was just read from it) — so the recovery document
 * loads with the hash present from its first byte. Recovery-only: the main app
 * authenticates via custom JWT and must not pick up a native-Telegram session.
 */
function recoveryHref(): string {
  const base = "/recovery";
  if (typeof window === "undefined") return base;

  const existing = window.location.hash;
  if (existing.startsWith("#tgWebAppData")) return `${base}${existing}`;

  const initData = getTelegramWebApp()?.initData;
  if (initData) return `${base}#tgWebAppData=${encodeURIComponent(initData)}`;

  return base;
}

function readMiniAppStartParam(): string | null {
  const telegramContext = readTelegramMiniAppContext();
  if (telegramContext?.startParam) return telegramContext.startParam;

  const mpChatContext = readMpChatMiniAppContext();
  return mpChatContext?.startParam || null;
}

function hasStrongTelegramLaunchSignal(): boolean {
  return Boolean(readTelegramInitData());
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
  reportMiniAppLaunch("redirect", { href });
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
 * Client splash rendered at `/`. Mini Apps deliver `start_param` only in the
 * client-side launch payload, so the server can never know the deep-link target
 * — resolution must happen here, after mount. We parse the start param, capture
 * any referral, then hard-redirect (`location.replace`) to the real destination
 * so the home entry is swapped out of history (no back-button trap, no list
 * flash) and the target renders via SSR instead of a contended RSC fetch (see
 * {@link redirectTo}).
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
    let cancelled = false;
    readyTelegramWebApp();
    reportMiniAppLaunch("mount", {
      isLikelyMpChatLaunch: isLikelyMpChatLaunch(),
      startParam: readMiniAppStartParam(),
      hasStrongTelegramLaunchSignal: hasStrongTelegramLaunchSignal(),
    });

    // Wallet recovery deep link wins before any normal start-param parsing:
    // `recovery_tg` is not a `v1-...` deep link, so it must be intercepted here
    // or it would fall through to the default redirect. Use `recoveryHref()`
    // (not the generic `redirectTo`) so a `#tgWebAppData=` hash is synthesized
    // from `WebApp.initData` when missing — Privy's seamless login depends on it.
    if (isTelegramRecoveryLaunch()) {
      reportMiniAppLaunch("telegram-recovery", { href: recoveryHref() });
      window.location.replace(recoveryHref());
      return () => {
        cancelled = true;
      };
    }

    const resolveStartParam = (startParam: string | null) => {
      if (cancelled) return;
      const parsed = startParam ? parseStartParam(startParam) : null;
      reportMiniAppLaunch("resolve-start-param", {
        startParam,
        parsed,
        staticSlug: parsed?.target ? matchSlugById(parsed.target) : null,
      });

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
    };

    const firstStartParam = readMiniAppStartParam();
    reportMiniAppLaunch("first-read", {
      firstStartParam,
      isLikelyMpChatLaunch: isLikelyMpChatLaunch(),
      hasStrongTelegramLaunchSignal: hasStrongTelegramLaunchSignal(),
    });
    if (
      firstStartParam ||
      hasStrongTelegramLaunchSignal() ||
      !isLikelyMpChatLaunch()
    ) {
      resolveStartParam(firstStartParam);
      return () => {
        cancelled = true;
      };
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const nextStartParam = readMiniAppStartParam();
      if (nextStartParam || Date.now() - startedAt >= MP_START_PARAM_RETRY_MS) {
        window.clearInterval(timer);
        reportMiniAppLaunch("mp-retry-finish", {
          nextStartParam,
          elapsedMs: Date.now() - startedAt,
        });
        resolveStartParam(nextStartParam);
      }
    }, MP_START_PARAM_RETRY_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
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
