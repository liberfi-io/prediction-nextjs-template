"use client";

/**
 * Smart Money leaderboard board.
 *
 * Composes a gradient hero (title + scoped tag + interval toggle) wrapping the
 * {@link Top3Podium}, followed by a virtualized multi-column table of ranked
 * wallets. The board flows naturally in the document so the whole page scrolls
 * as one: the hero + podium scroll away and the table fills the viewport. The
 * table virtualizes against the surrounding scroll container (the scaffold
 * content area) rather than an inner scrollbar.
 *
 * Layout / cell composition follows the product mock; the visual language
 * (zinc surfaces, bullish accent) follows the app theme. The table is fully
 * virtualized via `@tanstack/react-virtual`.
 */

import { memo, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "@liberfi.io/i18n";
import { cn, Sortable } from "@liberfi.io/ui";
import { CopyButton } from "../../../components/CopyButton";
import { GradientAvatar } from "../../../components/GradientAvatar";
import { useSmartMoneyBoard } from "../data/queries";
import {
  formatPercent,
  formatRate,
  formatRelativeTime,
  formatSignedUsd,
  formatUsd,
  intervalVolume,
  pnlColorClass,
  shortAddress,
} from "../format";
import type { LeaderboardInterval, SmartWalletEntry } from "../types";
import { BoardRowsSkeleton, PodiumSkeleton } from "./skeletons";
import { Top3Podium } from "./Top3Podium";

const INTERVALS: LeaderboardInterval[] = ["1d", "7d", "30d", "all"];
/** Estimated row height (px) for the virtualizer's first paint. */
const ROW_ESTIMATE = 60;

/**
 * Shared grid template so header + rows stay column-aligned. All seven columns
 * render at every breakpoint; on narrow screens the table scrolls horizontally
 * inside its wrapper (see {@link BoardTable}'s `overflow-x-auto` + `min-w`).
 */
const ROW_GRID =
  "grid grid-cols-[44px_minmax(120px,1fr)_120px_104px_104px_116px_72px] items-center gap-3";
/** Min table width that forces all columns; relaxes from `md` up. */
const TABLE_MIN_W = "min-w-[820px] md:min-w-0";

/** Hero gradient: soft bullish glow over the dark surface. */
const HERO_BG =
  "radial-gradient(130% 150% at 12% 0%, rgba(199,255,46,0.13), transparent 52%), linear-gradient(180deg, #0e1109 0%, #0a0a0b 100%)";

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

  return (
    <div className="flex flex-col gap-4">
      {/* Hero: title + scoped tag + interval toggle on a gradient surface */}
      <div
        className="relative overflow-hidden rounded-2xl border border-zinc-800/60 px-4 pb-5 pt-5 sm:px-6 sm:pb-6"
        style={{ background: HERO_BG }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                {t("extend.leaderboard.title")}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-bullish/30 bg-bullish/[0.07] px-2.5 py-0.5 text-[11px] font-medium text-bullish">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
                {t("extend.leaderboard.scopedTag")}
              </span>
            </div>
            <p className="text-sm text-zinc-400">{t("extend.leaderboard.subtitle")}</p>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-1 backdrop-blur">
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                type="button"
                onClick={() => onIntervalChange(iv)}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
                  interval === iv
                    ? "bg-bullish/15 text-bullish"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
                )}
              >
                {t(`extend.leaderboard.interval.${iv}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Podium lives on the hero gradient */}
        {isLoading ? (
          <div className="mt-6">
            <PodiumSkeleton />
          </div>
        ) : !isError && entries.length > 0 ? (
          <div className="mt-6">
            <Top3Podium entries={entries} selectedWallet={selectedWallet} onSelect={onSelect} />
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <BoardRowsSkeleton />
      ) : isError ? (
        <BoardEmpty message={t("extend.leaderboard.loadError")} />
      ) : entries.length === 0 ? (
        <BoardEmpty message={t("extend.leaderboard.emptyBoard")} />
      ) : (
        <BoardTable
          entries={entries}
          interval={interval}
          selectedWallet={selectedWallet}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

/**
 * Sortable columns. The "Vol / Txs" column exposes two independent sorts:
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
  selectedWallet,
  onSelect,
}: {
  entries: SmartWalletEntry[];
  interval: LeaderboardInterval;
  selectedWallet?: string;
  onSelect: (wallet: string) => void;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Front-end sorting: one active column at a time, cycling desc → asc → none
  // (matches the shared Sortable). `null` falls back to the backend rank order.
  const [sort, setSort] = useState<{ field: SortField; dir: "asc" | "desc" } | null>(null);
  const sortDirFor = (field: SortField) => (sort?.field === field ? sort.dir : undefined);
  const onSortChange = (field: SortField) => (dir?: "asc" | "desc") =>
    setSort(dir ? { field, dir } : null);

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

  const selected = selectedWallet?.toLowerCase();

  const windowShort =
    interval === "all" ? null : t(`extend.leaderboard.intervalShort.${interval}`);
  const netPnlLabel = windowShort
    ? t("extend.leaderboard.col.netPnlWindow", { w: windowShort })
    : t("extend.leaderboard.col.netPnl");
  const volLabel = windowShort
    ? t("extend.leaderboard.col.volWindow", { w: windowShort })
    : t("extend.leaderboard.col.vol");

  return (
    <div className="flex h-[calc(100dvh-152px-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/20 sm:h-[calc(100dvh-96px)]">
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
              <Sortable sort={sortDirFor("netPnl")} onSortChange={onSortChange("netPnl")}>
                {netPnlLabel}
              </Sortable>
            </span>
            <span className="flex justify-end text-right">
              <Sortable sort={sortDirFor("winRate")} onSortChange={onSortChange("winRate")}>
                {t("extend.leaderboard.col.winRate")}
              </Sortable>
            </span>
            <span className="flex justify-end text-right">
              <Sortable sort={sortDirFor("balance")} onSortChange={onSortChange("balance")}>
                {t("extend.leaderboard.col.balance")}
              </Sortable>
            </span>
            <span className="flex items-center justify-end gap-1 text-right">
              <Sortable sort={sortDirFor("vol")} onSortChange={onSortChange("vol")}>
                {volLabel}
              </Sortable>
              <span className="text-zinc-700">/</span>
              <Sortable sort={sortDirFor("txs")} onSortChange={onSortChange("txs")}>
                {t("extend.leaderboard.col.txs")}
              </Sortable>
            </span>
            <span className="flex justify-end text-right">
              <Sortable sort={sortDirFor("lastTrade")} onSortChange={onSortChange("lastTrade")}>
                {t("extend.leaderboard.col.lastTrade")}
              </Sortable>
            </span>
          </div>

          {/* Row scroll viewport — fills the box below the header; rows virtualize
              against it. */}
          <div ref={scrollRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
            <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((vItem) => {
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
                      active={selected === entry.wallet.toLowerCase()}
                      last={vItem.index === rows.length - 1}
                      onSelect={onSelect}
                    />
                  </div>
                );
              })}
            </div>
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
  active,
  last,
  onSelect,
}: {
  entry: SmartWalletEntry;
  position: number;
  interval: LeaderboardInterval;
  active: boolean;
  last: boolean;
  onSelect: (wallet: string) => void;
}) {
  const { t } = useTranslation();
  const vol = intervalVolume(entry, interval);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(entry.wallet)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(entry.wallet);
        }
      }}
      aria-current={active ? "true" : undefined}
      className={cn(
        ROW_GRID,
        "group w-full cursor-pointer px-3 py-3 text-left outline-none transition-colors focus-visible:bg-zinc-800/40",
        !last && "border-b border-zinc-800/40",
        active ? "bg-bullish/[0.06]" : "hover:bg-zinc-800/30",
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
          <div className="flex items-center gap-1">
            <span className="truncate font-mono text-sm font-medium text-zinc-100">
              {shortAddress(entry.wallet)}
            </span>
            <CopyButton
              value={entry.wallet}
              title={t("extend.leaderboard.copy")}
              className="opacity-100 transition-opacity focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            />
          </div>
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
        {formatRelativeTime(entry.lastActivityTs)}
      </div>
    </div>
  );
});

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
    <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800/40 bg-zinc-900/20">
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
