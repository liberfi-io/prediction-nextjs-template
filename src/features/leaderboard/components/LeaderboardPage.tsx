"use client";

/**
 * Smart Money Leaderboard page.
 *
 * Top-level sub-tabs switch between "Smart Money" (the ranked board: scoped-tag
 * header + interval toggle + Top-3 podium + virtualized table) and "Smart Live
 * Feed" (a follow-up placeholder). Across all breakpoints the board is a single
 * list; selecting a wallet opens the {@link WalletDetailPanel} as a full-screen
 * slide-over with a back button.
 *
 * Selection (`?wallet=`), time window (`?interval=`) and the active sub-tab
 * (`?view=`) all live in the URL so the state is shareable and survives the
 * browser back button.
 */

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import type { LeaderboardInterval } from "../types";
import { SmartLiveFeed } from "./SmartLiveFeed";
import { SmartMoneyBoard } from "./SmartMoneyBoard";
import { WalletDetailPanel } from "./WalletDetailPanel";

type LeaderboardView = "smart-money" | "live-feed";

const INTERVALS = new Set<LeaderboardInterval>(["1d", "7d", "30d", "all"]);
const VIEWS: LeaderboardView[] = ["smart-money", "live-feed"];

/** Default time window when none is set in the URL. */
const DEFAULT_INTERVAL: LeaderboardInterval = "7d";

function parseInterval(value: string | null): LeaderboardInterval {
  return value && INTERVALS.has(value as LeaderboardInterval)
    ? (value as LeaderboardInterval)
    : DEFAULT_INTERVAL;
}

function parseView(value: string | null): LeaderboardView {
  return value === "live-feed" ? "live-feed" : "smart-money";
}

export function LeaderboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const interval = parseInterval(searchParams.get("interval"));
  const view = parseView(searchParams.get("view"));
  const selectedWallet = searchParams.get("wallet") ?? undefined;

  /** Replace the URL search params without scrolling or adding history noise. */
  const updateParams = useCallback(
    (
      next: {
        wallet?: string | null;
        interval?: LeaderboardInterval;
        view?: LeaderboardView;
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

  // Switching the time window reloads the board and clears the selected wallet
  // so the detail does not show stale data.
  const handleInterval = useCallback(
    (next: LeaderboardInterval) => updateParams({ interval: next, wallet: null }, true),
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

  // The detail overlay only exists on the Smart Money view.
  const overlayOpen = view === "smart-money" && Boolean(selectedWallet);
  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlayOpen]);

  const boardProps = useMemo(
    () => ({
      interval,
      onIntervalChange: handleInterval,
      selectedWallet,
      onSelect: handleSelect,
    }),
    [interval, handleInterval, selectedWallet, handleSelect],
  );

  return (
    <>
      {/* Fixed secondary menu (Discover): pinned just below the 48px app header
          so it stays put while the page scrolls. */}
      <div className="fixed inset-x-0 top-12 z-30 border-b border-zinc-800/60 bg-[#0a0a0b]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1">
            {VIEWS.map((v) => (
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
      </div>

      {/* Content flows in the page; pt clears the fixed secondary menu. No bottom
          padding: the board box is sized to fill the screen left after the hero
          scrolls away, so it must reach the viewport bottom for its header to rest
          right under the fixed bars. */}
      <div className="mx-auto max-w-[1280px] px-4 pt-[60px] sm:px-6 lg:px-8">
        {view === "smart-money" ? <SmartMoneyBoard {...boardProps} /> : <SmartLiveFeed />}
      </div>

      {/* Detail: full-screen slide-over on every breakpoint */}
      {overlayOpen && selectedWallet && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={handleCloseDetail} />
          <div className="absolute inset-0 flex flex-col bg-[#0a0a0b] animate-in slide-in-from-right duration-200">
            <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800/60 px-4 py-3">
              <button
                type="button"
                onClick={handleCloseDetail}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                {t("extend.leaderboard.back")}
              </button>
            </div>
            <div className="mx-auto flex min-h-0 w-full max-w-[900px] flex-1 flex-col px-4 py-4 sm:px-6">
              <WalletDetailPanel key={selectedWallet} wallet={selectedWallet} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
