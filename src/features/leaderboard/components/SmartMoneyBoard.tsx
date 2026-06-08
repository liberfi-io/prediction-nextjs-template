"use client";

/**
 * Smart Money leaderboard — left master column.
 *
 * Renders the ALL / 7D interval toggle and a virtualized list of ranked wallet
 * rows. The column fills its parent's height (the page constrains it to the
 * viewport) so only the row list scrolls — the toggle stays pinned. Selecting a
 * row lifts the wallet up to {@link LeaderboardPage} (which mirrors it into the
 * `?wallet=` search param and renders the detail panel). Visuals reuse the
 * shared {@link GradientAvatar} so a wallet looks identical to the header
 * account avatar.
 */

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import { GradientAvatar } from "../../../components/GradientAvatar";
import { useSmartMoneyBoard } from "../data/queries";
import {
  formatRate,
  formatSignedUsd,
  pnlColorClass,
  shortAddress,
} from "../format";
import type { LeaderboardInterval, SmartWalletEntry } from "../types";
import { BoardRowsSkeleton } from "./skeletons";

const INTERVALS: LeaderboardInterval[] = ["all", "7d"];
/** Estimated row height (px) for the virtualizer's first paint. */
const ROW_ESTIMATE = 57;

export function SmartMoneyBoard({
  interval,
  onIntervalChange,
  selectedWallet,
  onSelect,
}: {
  interval: LeaderboardInterval;
  onIntervalChange: (interval: LeaderboardInterval) => void;
  selectedWallet?: string;
  onSelect: (wallet: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useSmartMoneyBoard(interval);

  const entries = data?.entries ?? [];
  const partial = data?.stateQuality === "partial";

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Interval toggle */}
      <div className="flex shrink-0 items-center gap-1.5">
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            type="button"
            onClick={() => onIntervalChange(iv)}
            className={cn(
              "cursor-pointer rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors",
              interval === iv
                ? "bg-bullish/10 text-bullish"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
            )}
          >
            {t(`extend.leaderboard.interval.${iv}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <BoardRowsSkeleton />
      ) : isError ? (
        <BoardEmpty message={t("extend.leaderboard.loadError")} />
      ) : entries.length === 0 ? (
        <BoardEmpty message={t("extend.leaderboard.emptyBoard")} />
      ) : (
        <>
          {partial && (
            <p className="shrink-0 px-1 text-xs text-amber-400/80">
              {t("extend.leaderboard.partialQuality")}
            </p>
          )}
          <BoardList
            entries={entries}
            selectedWallet={selectedWallet}
            onSelect={onSelect}
          />
        </>
      )}
    </div>
  );
}

function BoardList({
  entries,
  selectedWallet,
  onSelect,
}: {
  entries: SmartWalletEntry[];
  selectedWallet?: string;
  onSelect: (wallet: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const selected = selectedWallet?.toLowerCase();

  return (
    <div
      ref={parentRef}
      className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-zinc-800/40 bg-zinc-900/20"
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const entry = entries[vItem.index];
          return (
            <div
              key={entry.wallet}
              ref={virtualizer.measureElement}
              data-index={vItem.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${vItem.start}px)` }}
            >
              <BoardRow
                entry={entry}
                active={selected === entry.wallet.toLowerCase()}
                last={vItem.index === entries.length - 1}
                onSelect={onSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardRow({
  entry,
  active,
  last,
  onSelect,
}: {
  entry: SmartWalletEntry;
  active: boolean;
  last: boolean;
  onSelect: (wallet: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.wallet)}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
        !last && "border-b border-zinc-800/40",
        active ? "bg-bullish/[0.06]" : "hover:bg-zinc-800/30",
      )}
    >
      <span
        className={cn(
          "w-5 shrink-0 text-center text-sm font-semibold tabular-nums",
          entry.rank <= 3 ? "text-bullish" : "text-zinc-500",
        )}
      >
        {entry.rank}
      </span>
      <GradientAvatar seed={entry.wallet} size={32} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-sm font-medium text-zinc-100">
          {shortAddress(entry.wallet)}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {formatRate(entry.winRate)} {t("extend.leaderboard.col.winRate")} ·{" "}
          {entry.marketCount} {t("extend.leaderboard.col.markets")}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn("text-sm font-semibold tabular-nums", pnlColorClass(entry.totalPnl))}>
          {formatSignedUsd(entry.totalPnl)}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">PNL</div>
      </div>
    </button>
  );
}

function BoardEmpty({ message }: { message: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800/40 bg-zinc-900/20">
      <svg
        viewBox="0 0 24 24"
        width={32}
        height={32}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-zinc-700"
        aria-hidden
      >
        <path d="M3 3v16a2 2 0 0 0 2 2h16" />
        <path d="M7 16l4-8 4 4 6-10" />
      </svg>
      <span className="text-sm text-zinc-500">{message}</span>
    </div>
  );
}
