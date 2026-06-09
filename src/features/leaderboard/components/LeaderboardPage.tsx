"use client";

/**
 * Smart Money Leaderboard page.
 *
 * Top-level sub-tabs switch between "Smart Money" (the ranked board with scope
 * and interval controls + virtualized table) and "Smart Live Feed" (a follow-up
 * placeholder). Across all breakpoints the board is a single list; selecting a
 * wallet opens the {@link WalletDetailPanel} as a full-screen slide-over with a
 * back button.
 *
 * Selection (`?wallet=`), time window (`?interval=`) and the active sub-tab
 * (`?view=`) all live in the URL so the state is shareable and survives the
 * browser back button.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import type { LeaderboardInterval } from "../types";
import { LEADERBOARD_TAG } from "../data/client";
import { SmartLiveFeed } from "./SmartLiveFeed";
import { SmartMoneyBoard } from "./SmartMoneyBoard";
import { WalletDetailPanel } from "./WalletDetailPanel";

type LeaderboardView = "smart-money" | "live-feed";
type LeaderboardScope = "all" | "worldcup";

const INTERVAL_OPTIONS: LeaderboardInterval[] = ["1d", "7d", "30d", "all"];
const INTERVALS = new Set<LeaderboardInterval>(INTERVAL_OPTIONS);
const VIEWS: LeaderboardView[] = ["smart-money", "live-feed"];
const SCOPES: LeaderboardScope[] = ["all", "worldcup"];

/**
 * Smart Live Feed is not built yet — hide its tab (and ignore `?view=live-feed`)
 * until it ships. Flip to `true` to re-enable.
 */
const ENABLE_LIVE_FEED = false;
const VISIBLE_VIEWS: LeaderboardView[] = ENABLE_LIVE_FEED
  ? VIEWS
  : VIEWS.filter((v) => v !== "live-feed");

/** Default time window when none is set in the URL. */
const DEFAULT_INTERVAL: LeaderboardInterval = "7d";
/** Default smart-money scope when none is set in the URL. */
const DEFAULT_SCOPE: LeaderboardScope = "worldcup";

function parseInterval(value: string | null): LeaderboardInterval {
  return value && INTERVALS.has(value as LeaderboardInterval)
    ? (value as LeaderboardInterval)
    : DEFAULT_INTERVAL;
}

function parseView(value: string | null): LeaderboardView {
  return value === "live-feed" && ENABLE_LIVE_FEED ? "live-feed" : "smart-money";
}

function parseScope(value: string | null): LeaderboardScope {
  return value === "all" ? "all" : DEFAULT_SCOPE;
}

export function LeaderboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const interval = parseInterval(searchParams.get("interval"));
  const view = parseView(searchParams.get("view"));
  const scope = parseScope(searchParams.get("scope"));
  const selectedWallet = searchParams.get("wallet") ?? undefined;

  // Switching the interval is a soft navigation (the server re-prefetches the
  // board for the new window), so we wrap it in a transition to drive a loading
  // state and optimistically track the clicked window for instant toggle
  // feedback while the navigation is pending.
  const [isPending, startTransition] = useTransition();
  const [pendingInterval, setPendingInterval] = useState<LeaderboardInterval | null>(null);
  const [pendingScope, setPendingScope] = useState<LeaderboardScope | null>(null);
  useEffect(() => {
    setPendingInterval(null);
    setPendingScope(null);
  }, [interval, scope]);

  /** Replace the URL search params without scrolling or adding history noise. */
  const updateParams = useCallback(
    (
      next: {
        wallet?: string | null;
        interval?: LeaderboardInterval;
        view?: LeaderboardView;
        scope?: LeaderboardScope;
      },
      replace = false,
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.interval) {
        if (next.interval === DEFAULT_INTERVAL) params.delete("interval");
        else params.set("interval", next.interval);
      }
      if (next.view) {
        if (next.view === "smart-money") params.delete("view");
        else params.set("view", next.view);
      }
      if (next.scope) {
        if (next.scope === DEFAULT_SCOPE) params.delete("scope");
        else params.set("scope", next.scope);
      }
      if ("wallet" in next) {
        if (next.wallet) params.set("wallet", next.wallet);
        else params.delete("wallet");
      }
      const qs = params.toString();
      const url = qs ? `/leaderboard?${qs}` : "/leaderboard";
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [router, searchParams],
  );

  const handleSelect = useCallback(
    (wallet: string) => updateParams({ wallet }),
    [updateParams],
  );

  const handleScope = useCallback(
    (next: LeaderboardScope) => {
      setPendingScope(next);
      startTransition(() => updateParams({ scope: next, wallet: null }, true));
    },
    [updateParams],
  );

  // Switching the time window reloads the board and clears the selected wallet
  // so the detail does not show stale data. Run inside a transition so the board
  // can show a loading skeleton while the server re-prefetches.
  const handleInterval = useCallback(
    (next: LeaderboardInterval) => {
      setPendingInterval(next);
      startTransition(() => updateParams({ interval: next, wallet: null }, true));
    },
    [updateParams],
  );

  // Switching sub-tab clears any open wallet detail.
  const handleView = useCallback(
    (next: LeaderboardView) => updateParams({ view: next, wallet: null }, true),
    [updateParams],
  );

  const handleCloseDetail = useCallback(
    () => updateParams({ wallet: null }),
    [updateParams],
  );

  // The detail only shows on the Smart Money view.
  const detailOpen = view === "smart-money" && Boolean(selectedWallet);
  const activeScope = pendingScope ?? scope;
  const leaderboardTag = scope === "worldcup" ? LEADERBOARD_TAG : null;

  const boardProps = useMemo(
    () => ({
      interval,
      tag: leaderboardTag,
      pending: isPending,
      selectedWallet,
      onSelect: handleSelect,
    }),
    [
      interval,
      leaderboardTag,
      isPending,
      selectedWallet,
      handleSelect,
    ],
  );

  return (
    <div
      className={cn(
        "w-full",
        detailOpen
          ? "h-full pt-3"
          : "flex h-full min-h-0 flex-col overflow-hidden",
      )}
    >
      {!detailOpen && (
        <div className="shrink-0 border-b border-zinc-800/60 bg-[#0a0a0b]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1280px] items-center gap-1 px-4 py-2 sm:px-6 lg:px-10 xl:px-12">
            {VISIBLE_VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleView(v)}
                className={cn(
                  "cursor-pointer rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
                  view === v
                    ? "bg-bullish/15 text-bullish"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
                )}
              >
                {t(`extend.leaderboard.views.${v === "smart-money" ? "smartMoney" : "liveFeed"}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className={cn(
          "mx-auto flex w-full max-w-[1280px] min-h-0 flex-1 flex-col px-4 sm:px-6 lg:px-10 xl:px-12",
          detailOpen && "pt-3",
        )}
      >
        {!detailOpen && view === "smart-money" && (
          <div className="flex shrink-0 flex-col gap-2 py-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-x-1.5 pl-1 lg:w-full lg:gap-x-2">
                {SCOPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleScope(s)}
                    className={cn(
                      "flex min-w-14 shrink-0 cursor-pointer items-center justify-center gap-x-1 rounded-2xl border px-3 py-1.5 text-sm font-medium uppercase transition-colors",
                      activeScope === s
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border/80 text-neutral-500 hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    {s === "worldcup" && (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                        <path d="M4 22h16" />
                        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                      </svg>
                    )}
                    {s === "worldcup"
                      ? t("extend.leaderboard.scopedTag")
                      : t("extend.leaderboard.scopes.all")}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex w-fit items-center gap-1 rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-1 backdrop-blur lg:shrink-0">
              {INTERVAL_OPTIONS.map((iv) => (
                <button
                  key={iv}
                  type="button"
                  onClick={() => handleInterval(iv)}
                  className={cn(
                    "cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
                    (pendingInterval ?? interval) === iv
                      ? "bg-bullish/15 text-bullish"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
                  )}
                >
                  {t(`extend.leaderboard.interval.${iv}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {view !== "smart-money" ? (
          <div className="min-h-0 flex-1">
            <SmartLiveFeed />
          </div>
        ) : detailOpen && selectedWallet ? (
          <div className="h-[calc(100dvh-116px-env(safe-area-inset-bottom))] sm:h-[calc(100dvh-60px)]">
            <WalletDetailPanel
              key={selectedWallet}
              wallet={selectedWallet}
              onBack={handleCloseDetail}
            />
          </div>
        ) : (
          <div className="flex min-h-0 w-full flex-1 pb-4">
            <SmartMoneyBoard {...boardProps} />
          </div>
        )}
      </div>
    </div>
  );
}
