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

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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

function parseInterval(value: string | null): LeaderboardInterval {
  return value && INTERVALS.has(value as LeaderboardInterval)
    ? (value as LeaderboardInterval)
    : DEFAULT_INTERVAL;
}

function parseView(value: string | null): LeaderboardView {
  return value === "live-feed" && ENABLE_LIVE_FEED ? "live-feed" : "smart-money";
}

export function LeaderboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const interval = parseInterval(searchParams.get("interval"));
  const view = parseView(searchParams.get("view"));
  const selectedWallet = searchParams.get("wallet") ?? undefined;

  // Switching the interval is a soft navigation (the server re-prefetches the
  // board for the new window), so we wrap it in a transition to drive a loading
  // state and optimistically track the clicked window for instant toggle
  // feedback while the navigation is pending.
  const [isPending, startTransition] = useTransition();
  const [pendingInterval, setPendingInterval] = useState<LeaderboardInterval | null>(null);
  useEffect(() => {
    setPendingInterval(null);
  }, [interval]);

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

  const boardProps = useMemo(
    () => ({
      interval,
      selectedInterval: pendingInterval ?? interval,
      pending: isPending,
      onIntervalChange: handleInterval,
      selectedWallet,
      onSelect: handleSelect,
    }),
    [interval, pendingInterval, isPending, handleInterval, selectedWallet, handleSelect],
  );

  return (
    <>
      {/* Fixed secondary menu (Discover): pinned just below the 48px app header
          so it stays put while the page scrolls. Hidden on the wallet detail —
          the detail has its own back button instead. */}
      {!detailOpen && (
        <div className="fixed inset-x-0 top-12 z-30 border-b border-zinc-800/60 bg-[#0a0a0b]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-10 xl:px-12">
            <div className="flex items-center gap-1">
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
        </div>
      )}

      {/* Content flows in the page within the global layout (Scaffold header /
          footer stay visible). For the board, pt clears the fixed secondary
          menu; on the wallet detail the menu is hidden, so only a small top gap
          is needed and the detail box fills the screen left under the app header
          (no secondary nav to subtract) and scrolls internally, with its own
          back button (left of the avatar). */}
      <div
        className={cn(
          "mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10 xl:px-12",
          detailOpen ? "pt-3" : "pt-[60px]",
        )}
      >
        {view !== "smart-money" ? (
          <SmartLiveFeed />
        ) : detailOpen && selectedWallet ? (
          <div className="h-[calc(100dvh-116px-env(safe-area-inset-bottom))] sm:h-[calc(100dvh-60px)]">
            <WalletDetailPanel
              key={selectedWallet}
              wallet={selectedWallet}
              onBack={handleCloseDetail}
            />
          </div>
        ) : (
          <SmartMoneyBoard {...boardProps} />
        )}
      </div>
    </>
  );
}
