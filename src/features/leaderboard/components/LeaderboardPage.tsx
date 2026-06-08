"use client";

/**
 * Smart Money Leaderboard page — master-detail container.
 *
 * Desktop (>1024px): two columns — the {@link SmartMoneyBoard} on the left and
 * the {@link WalletDetailPanel} inline on the right. Tablet / mobile: a single
 * board column; selecting a wallet opens a full-screen slide-over sheet with a
 * back button.
 *
 * The selected wallet is mirrored into the `?wallet=` search param so the
 * selection is shareable and survives the browser back button. The board's
 * first entry is auto-selected on desktop once data loads.
 */

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { useScreen } from "@liberfi.io/ui";
import { useSmartMoneyBoard } from "../data/queries";
import type { LeaderboardInterval } from "../types";
import { SmartMoneyBoard } from "./SmartMoneyBoard";
import { WalletDetailPanel } from "./WalletDetailPanel";
import { WalletDetailSkeleton } from "./skeletons";

const INTERVALS = new Set<LeaderboardInterval>(["all", "7d"]);

function parseInterval(value: string | null): LeaderboardInterval {
  return value && INTERVALS.has(value as LeaderboardInterval)
    ? (value as LeaderboardInterval)
    : "all";
}

export function LeaderboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDesktop } = useScreen();

  const interval = parseInterval(searchParams.get("interval"));
  const selectedWallet = searchParams.get("wallet") ?? undefined;

  // The board data is shared (React Query dedups) so reading it here for the
  // desktop auto-select does not trigger an extra request.
  const { data: board, isLoading: boardLoading } = useSmartMoneyBoard(interval);

  /** Replace the URL search params without scrolling or adding history noise. */
  const updateParams = useCallback(
    (next: { wallet?: string | null; interval?: LeaderboardInterval }, replace = false) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.interval) {
        if (next.interval === "all") params.delete("interval");
        else params.set("interval", next.interval);
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

  // Switching the time window reloads the board; clearing the selected wallet
  // resets the detail column so it does not show stale data and re-runs the
  // desktop auto-select against the new ranking (both columns show skeletons).
  const handleInterval = useCallback(
    (next: LeaderboardInterval) => updateParams({ interval: next, wallet: null }, true),
    [updateParams],
  );

  const handleCloseDetail = useCallback(
    () => updateParams({ wallet: null }),
    [updateParams],
  );

  // Desktop auto-selects the top-ranked wallet once the board loads and nothing
  // is selected yet. Mobile leaves the detail closed until the user taps a row.
  const firstWallet = board?.entries[0]?.wallet;
  useEffect(() => {
    if (isDesktop && !selectedWallet && firstWallet) {
      updateParams({ wallet: firstWallet }, true);
    }
  }, [isDesktop, selectedWallet, firstWallet, updateParams]);

  // On mobile/tablet the detail is an overlay; lock body scroll while open.
  const overlayOpen = !isDesktop && Boolean(selectedWallet);
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

  // Desktop right column: skeleton while the board reloads (e.g. interval
  // switch) or while the auto-select is pending, the panel once a wallet is
  // chosen (keyed by wallet so a switch remounts → its own loading skeleton),
  // and the empty prompt only when the board has no entries to select from.
  let desktopDetail: React.ReactNode;
  if (boardLoading) {
    desktopDetail = <WalletDetailSkeleton />;
  } else if (selectedWallet) {
    desktopDetail = <WalletDetailPanel key={selectedWallet} wallet={selectedWallet} />;
  } else if (board && board.entries.length > 0) {
    desktopDetail = <WalletDetailSkeleton />;
  } else {
    desktopDetail = <SelectPrompt message={t("extend.leaderboard.selectWallet")} />;
  }

  return (
    <div className="mx-auto flex h-full max-w-[1280px] flex-col px-4 pt-6 pb-4 sm:px-6 sm:pt-8 lg:px-8">
      {/* Title */}
      <div className="mb-5 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t("extend.leaderboard.title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t("extend.leaderboard.subtitle")}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
        {/* Left: board */}
        <div className="flex min-h-0 w-full flex-col lg:w-[400px] lg:shrink-0">
          <SmartMoneyBoard {...boardProps} />
        </div>

        {/* Right: detail (desktop inline) */}
        <div className="hidden min-w-0 flex-1 lg:flex lg:min-h-0 lg:flex-col">
          {desktopDetail}
        </div>
      </div>

      {/* Mobile / tablet: full-screen slide-over sheet */}
      {overlayOpen && selectedWallet && (
        <div className="fixed inset-0 z-50 lg:hidden">
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
            <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
              <WalletDetailPanel key={selectedWallet} wallet={selectedWallet} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectPrompt({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800/60 bg-zinc-900/10">
      <svg
        viewBox="0 0 24 24"
        width={36}
        height={36}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-zinc-700"
        aria-hidden
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <span className="text-sm text-zinc-500">{message}</span>
    </div>
  );
}
