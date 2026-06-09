"use client";

/**
 * Smart Money leaderboard board.
 *
 * Renders the virtualized multi-column table of ranked wallets. The board flows
 * naturally in the document so the whole page scrolls as one; the table
 * virtualizes against the surrounding scroll container (the scaffold content
 * area) rather than an inner scrollbar.
 *
 * Layout / cell composition follows the product mock; the visual language
 * (zinc surfaces, bullish accent) follows the app theme. The table is fully
 * virtualized via `@tanstack/react-virtual`.
 */

import { memo, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTickAge } from "@liberfi.io/hooks";
import { useTranslation } from "@liberfi.io/i18n";
import { cn, Sortable } from "@liberfi.io/ui";
import { CopyInline } from "../../../components/CopyButton";
import { GradientAvatar } from "../../../components/GradientAvatar";
import { useSmartMoneyBoard } from "../data/queries";
import {
  formatPercent,
  formatRate,
  formatAgeMs,
  formatSignedUsd,
  formatUsd,
  intervalVolume,
  parseTimestampMs,
  pnlColorClass,
  shortAddress,
} from "../format";
import type { LeaderboardInterval, SmartWalletEntry } from "../types";
import { BoardBodySkeleton, BoardRowsSkeleton } from "./skeletons";

/** Estimated row height (px) for the virtualizer's first paint. */
const ROW_ESTIMATE = 60;

/**
 * Shared grid template so header + rows stay column-aligned. Every column has
 * a practical minimum width; above the minimum table width, columns grow by
 * their fr ratios so wide screens use the available space evenly.
 */
const ROW_GRID =
  "grid grid-cols-[minmax(44px,0.35fr)_minmax(108px,1.2fr)_minmax(140px,1.15fr)_minmax(128px,1fr)_minmax(132px,1fr)_minmax(148px,1.2fr)_minmax(104px,0.85fr)] items-center gap-3";
/** Minimum table width; narrower viewports scroll horizontally. */
const TABLE_MIN_W = "w-full min-w-[908px]";
const DESC_ONLY_SORT = ["desc"] as const;

export function SmartMoneyBoard({
  interval,
  tag,
  pending = false,
  onSelect,
  onPrefetch,
}: {
  /** Committed window driving the data query + column labels. */
  interval: LeaderboardInterval;
  /** Product tag for scoped results; `null` requests the unscoped board. */
  tag?: string | null;
  /** True while a window switch navigation is in flight: forces the skeleton. */
  pending?: boolean;
  onSelect: (wallet: string) => void;
  onPrefetch?: (wallet: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useSmartMoneyBoard(interval, tag);

  // While switching windows the board re-prefetches on the server, so surface a
  // skeleton for that pending phase too — not just the initial query load.
  const loading = isLoading || pending;
  const entries = data?.entries ?? [];

  return (
    <div className="flex min-h-0 w-full flex-1">
      {loading ? (
        <BoardRowsSkeleton />
      ) : isError ? (
        <BoardEmpty message={t("extend.leaderboard.loadError")} />
      ) : entries.length === 0 ? (
        <BoardEmpty message={t("extend.leaderboard.emptyBoard")} />
      ) : (
        <BoardTable
          entries={entries}
          interval={interval}
          onSelect={onSelect}
          onPrefetch={onPrefetch}
        />
      )}
    </div>
  );
}

/**
 * Descending-only sortable columns. The "Vol / Txs" column exposes two independent sorts:
 * `vol` (traded volume) and `txs` (transaction count).
 */
type SortField = "netPnl" | "winRate" | "balance" | "vol" | "txs" | "lastTrade";

/** Numeric sort accessor for a column. */
function sortValue(entry: SmartWalletEntry, field: SortField, interval: LeaderboardInterval): number {
  switch (field) {
    case "netPnl":
      return entry.score;
    case "winRate":
      return entry.winRate;
    case "balance":
      return entry.currentValue;
    case "vol":
      return intervalVolume(entry, interval);
    case "txs":
      return Number(entry.sevenDayActivityCount) || 0;
    case "lastTrade": {
      const ts = entry.lastActivityTs;
      if (ts == null) return 0;
      const n = Number(ts);
      return Number.isFinite(n) && n > 0 ? n : Date.parse(String(ts)) || 0;
    }
  }
}

function BoardTable({
  entries,
  interval,
  onSelect,
  onPrefetch,
}: {
  entries: SmartWalletEntry[];
  interval: LeaderboardInterval;
  onSelect: (wallet: string) => void;
  onPrefetch?: (wallet: string) => void;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Front-end sorting: one active column at a time, cycling desc → none.
  // `null` falls back to the backend rank order.
  const [sort, setSort] = useState<{ field: SortField; dir: "desc" } | null>(null);
  const sortDirFor = (field: SortField) => (sort?.field === field ? sort.dir : undefined);
  const onSortChange = (field: SortField) => (dir?: "asc" | "desc") =>
    setSort(dir === "desc" ? { field, dir } : null);

  const rows = useMemo(() => {
    if (!sort) return entries;
    const sorted = [...entries].sort(
      (a, b) => sortValue(a, sort.field, interval) - sortValue(b, sort.field, interval),
    );
    return sort.dir === "desc" ? sorted.reverse() : sorted;
  }, [entries, sort, interval]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const waitingForVirtualRows = rows.length > 0 && virtualItems.length === 0;

  const windowShort =
    interval === "all" ? null : t(`extend.leaderboard.intervalShort.${interval}`);
  const netPnlLabel = windowShort
    ? t("extend.leaderboard.col.netPnlWindow", { w: windowShort })
    : t("extend.leaderboard.col.netPnl");
  const volLabel = windowShort
    ? t("extend.leaderboard.col.volWindow", { w: windowShort })
    : t("extend.leaderboard.col.vol");

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/20">
      {/* Single bounded box: the column header is a fixed top section, rows scroll
          vertically inside, and on narrow screens the whole thing scrolls
          horizontally so every column stays reachable. The box height fills the
          screen left once the hero scrolls away (viewport − app header 48px −
          secondary nav 48px − mobile footer 56px), so the header naturally rests
          just under the fixed bars with no sticky needed. */}
      <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-x-auto">
        <div className={cn(TABLE_MIN_W, "flex min-h-0 flex-1 flex-col")}>
          {/* Column header — fixed top section (not scrolled by the rows below). */}
          <div
            className={cn(
              ROW_GRID,
              "shrink-0 border-b border-zinc-800/50 px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500",
            )}
          >
            <span className="text-center">#</span>
            <span>{t("extend.leaderboard.col.trader")}</span>
            <span className="flex justify-end text-right">
              <Sortable sort={sortDirFor("netPnl")} onSortChange={onSortChange("netPnl")} directions={DESC_ONLY_SORT}>
                {netPnlLabel}
              </Sortable>
            </span>
            <span className="flex justify-end text-right">
              <Sortable sort={sortDirFor("winRate")} onSortChange={onSortChange("winRate")} directions={DESC_ONLY_SORT}>
                {t("extend.leaderboard.col.winRate")}
              </Sortable>
            </span>
            <span className="flex justify-end text-right">
              <Sortable sort={sortDirFor("balance")} onSortChange={onSortChange("balance")} directions={DESC_ONLY_SORT}>
                {t("extend.leaderboard.col.balance")}
              </Sortable>
            </span>
            <span className="flex items-center justify-end gap-1 text-right">
              <Sortable sort={sortDirFor("vol")} onSortChange={onSortChange("vol")} directions={DESC_ONLY_SORT}>
                {volLabel}
              </Sortable>
              <span className="text-zinc-700">/</span>
              <Sortable sort={sortDirFor("txs")} onSortChange={onSortChange("txs")} directions={DESC_ONLY_SORT}>
                {t("extend.leaderboard.col.txs")}
              </Sortable>
            </span>
            <span className="flex justify-end text-right">
              <Sortable sort={sortDirFor("lastTrade")} onSortChange={onSortChange("lastTrade")} directions={DESC_ONLY_SORT}>
                {t("extend.leaderboard.col.lastTrade")}
              </Sortable>
            </span>
          </div>

          {/* Row scroll viewport — fills the box below the header; rows virtualize
              against it. */}
          <div ref={scrollRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
            {waitingForVirtualRows ? (
              <BoardBodySkeleton rows={Math.min(rows.length, 10)} />
            ) : (
              <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                {virtualItems.map((vItem) => {
                  const entry = rows[vItem.index];
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
                        position={vItem.index + 1}
                        interval={interval}
                        last={vItem.index === rows.length - 1}
                        onSelect={onSelect}
                        onPrefetch={onPrefetch}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Memoized so scrolling (which re-renders the parent with fresh virtual-item
 * offsets) does not re-render row internals — only the wrapper transform moves.
 * Safe because `onSelect` is a stable `useCallback`, `entry` is a stable query
 * reference, and the rest are primitives.
 */
const BoardRow = memo(function BoardRow({
  entry,
  position,
  interval,
  last,
  onSelect,
  onPrefetch,
}: {
  entry: SmartWalletEntry;
  position: number;
  interval: LeaderboardInterval;
  last: boolean;
  onSelect: (wallet: string) => void;
  onPrefetch?: (wallet: string) => void;
}) {
  const { t } = useTranslation();
  const vol = intervalVolume(entry, interval);

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => onPrefetch?.(entry.wallet)}
      onClick={() => onSelect(entry.wallet)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(entry.wallet);
        }
      }}
      className={cn(
        ROW_GRID,
        "group w-full cursor-pointer px-3 py-3 text-left outline-none transition-colors focus-visible:bg-zinc-800/40",
        !last && "border-b border-zinc-800/40",
        "hover:bg-zinc-800/30",
      )}
    >
      {/* Rank — follows the displayed row position, not the data's rank. */}
      <div className="flex justify-center">
        <RankBadge position={position} />
      </div>

      {/* Trader */}
      <div className="flex min-w-0 items-center gap-2.5">
        <GradientAvatar seed={entry.wallet} size={32} className="!rounded-full" />
        <div className="min-w-0">
          <CopyInline value={entry.wallet} title={t("extend.leaderboard.copy")}>
            <span className="truncate font-mono text-sm font-medium text-zinc-100">
              {shortAddress(entry.wallet)}
            </span>
          </CopyInline>
          <div className="mt-0.5 text-xs text-zinc-500">
            {entry.marketCount} {t("extend.leaderboard.col.markets")}
          </div>
        </div>
      </div>

      {/* Net PNL (window) + ratio */}
      <div className="text-right">
        <div className={cn("text-sm font-semibold tabular-nums", pnlColorClass(entry.score))}>
          {formatSignedUsd(entry.score)}
        </div>
        <div className={cn("mt-0.5 text-xs tabular-nums", pnlColorClass(entry.totalPnlRatio))}>
          {formatPercent(entry.totalPnlRatio)}
        </div>
      </div>

      {/* Win rate + avg bet */}
      <div className="text-right">
        <div className="text-sm font-medium tabular-nums text-zinc-200">
          {formatRate(entry.winRate)}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {formatUsd(entry.avgInitialCost)} {t("extend.leaderboard.col.avgBet")}
        </div>
      </div>

      {/* Balance */}
      <div className="text-right text-sm font-medium tabular-nums text-zinc-200">
        {formatUsd(entry.currentValue)}
      </div>

      {/* Volume / txs */}
      <div className="text-right">
        <div className="text-sm font-medium tabular-nums text-zinc-200">{formatUsd(vol)}</div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {entry.sevenDayActivityCount} {t("extend.leaderboard.col.txs")}
        </div>
      </div>

      {/* Last trade */}
      <div className="text-right text-xs tabular-nums text-zinc-500">
        <LastTradeAge ts={entry.lastActivityTs} />
      </div>
    </div>
  );
});

function LastTradeAge({ ts }: { ts: string | number | null | undefined }) {
  const timestampMs = parseTimestampMs(ts);
  const ageMs = useTickAge(timestampMs ?? Date.now());
  return timestampMs == null ? "—" : formatAgeMs(ageMs);
}

/** Gold / silver / bronze medal styles for the top-3 positions. */
const MEDALS: Record<1 | 2 | 3, { gradient: string; shadow: string; text: string }> = {
  1: { gradient: "linear-gradient(135deg,#fde68a,#f59e0b)", shadow: "0 0 10px rgba(245,158,11,0.45)", text: "#1a1a05" },
  2: { gradient: "linear-gradient(135deg,#f1f5f9,#94a3b8)", shadow: "0 0 10px rgba(148,163,184,0.4)", text: "#11151c" },
  3: { gradient: "linear-gradient(135deg,#e9b277,#b45309)", shadow: "0 0 10px rgba(180,83,9,0.4)", text: "#1a0f03" },
};

/**
 * Rank indicator keyed off the row position. Positions 1-3 render a gold /
 * silver / bronze medal badge; the rest show a plain muted number.
 */
function RankBadge({ position }: { position: number }) {
  if (position >= 1 && position <= 3) {
    const m = MEDALS[position as 1 | 2 | 3];
    return (
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums"
        style={{ background: m.gradient, boxShadow: m.shadow, color: m.text }}
      >
        {position}
      </span>
    );
  }
  return <span className="text-sm font-semibold tabular-nums text-zinc-500">{position}</span>;
}

function BoardEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800/40 bg-zinc-900/20 pb-4">
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
