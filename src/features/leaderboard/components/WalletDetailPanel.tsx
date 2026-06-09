"use client";

/**
 * Wallet detail — right detail column of the Smart Money master-detail layout.
 *
 * Composes the wallet header, an OVERVIEW hero, a PERFORMANCE grid, a
 * collapsible YIELD & RISK panel, and the POSITIONS / CLOSED / ACTIVITY tabs.
 * The panel fills its column height: the stats block stays pinned while only
 * the active tab's list scrolls. All three lists are virtualized (the ACTIVITY
 * tab additionally fetches more pages as the user scrolls to the bottom).
 *
 * Data comes from {@link useWalletPnl} and {@link useWalletActivities}; all
 * numeric formatting goes through `../format`. The panel is remounted (keyed by
 * wallet) by the parent on selection change so a switch always shows its own
 * loading skeleton.
 */

import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import { CopyInline } from "../../../components/CopyButton";
import { GradientAvatar } from "../../../components/GradientAvatar";
import { useWalletActivities, useWalletPnl } from "../data/queries";
import {
  formatHoldingTime,
  formatPercent,
  formatPrice,
  formatRate,
  formatSignedUsd,
  formatUsd,
  pnlColorClass,
  shortAddress,
} from "../format";
import type {
  WalletActivity,
  WalletPnlDetail,
  WalletPnlSummary,
  WalletTokenPnl,
} from "../types";
import { DetailRowsSkeleton, WalletDetailSkeleton } from "./skeletons";

type DetailTab = "positions" | "closed" | "activity";

/** Estimated list row height (px) for the virtualizer's first paint. */
const ROW_ESTIMATE = 64;

export function WalletDetailPanel({ wallet }: { wallet: string }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useWalletPnl(wallet);

  if (isLoading) return <WalletDetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="flex h-full flex-col gap-4">
        <WalletHeader wallet={wallet} />
        <EmptyBlock message={t("extend.leaderboard.loadError")} fill />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-4">
        <WalletHeader wallet={wallet} summary={data.summary} />
        <WalletOverview summary={data.summary} />
        <WalletPerformance summary={data.summary} />
        <YieldRiskPanel summary={data.summary} />
      </div>
      <WalletPositionsTabs wallet={wallet} detail={data} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function WalletHeader({
  wallet,
  summary,
}: {
  wallet: string;
  summary?: WalletPnlSummary;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3">
      <GradientAvatar seed={wallet} size={48} className="!rounded-xl" />
      <div className="min-w-0">
        <CopyInline value={wallet} title={t("extend.leaderboard.copy")} size={14}>
          <span className="truncate font-mono text-base font-semibold text-white">
            {shortAddress(wallet, 8, 6)}
          </span>
        </CopyInline>
        {summary && (
          <div className="mt-0.5 text-xs text-zinc-500">
            {summary.marketCount} {t("extend.leaderboard.col.markets")} ·{" "}
            {formatRate(summary.winRate)} {t("extend.leaderboard.col.winRate")}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview (hero)
// ---------------------------------------------------------------------------

function WalletOverview({ summary }: { summary: WalletPnlSummary }) {
  const { t } = useTranslation();
  return (
    <section>
      <SectionTitle>{t("extend.leaderboard.overview.title")}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <HeroCard label={t("extend.leaderboard.overview.totalValue")}>
          <span className="text-xl font-bold text-white">
            {formatUsd(summary.currentValue)}
          </span>
        </HeroCard>
        <HeroCard label={t("extend.leaderboard.overview.totalPnl")}>
          <span className={cn("text-xl font-bold", pnlColorClass(summary.totalPnl))}>
            {formatSignedUsd(summary.totalPnl)}
          </span>
          <span className={cn("ml-1.5 text-sm font-medium", pnlColorClass(summary.totalPnl))}>
            {formatPercent(summary.totalPnlRatio)}
          </span>
        </HeroCard>
        <HeroCard
          label={t("extend.leaderboard.overview.sevenDayPnl")}
          className="col-span-2 sm:col-span-1"
        >
          <span className={cn("text-xl font-bold", pnlColorClass(summary.sevenDayRealizedPnl))}>
            {formatSignedUsd(summary.sevenDayRealizedPnl)}
          </span>
        </HeroCard>
      </div>
    </section>
  );
}

function HeroCard({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4",
        className,
      )}
    >
      <div className="mb-1.5 text-xs font-medium text-zinc-500">{label}</div>
      <div className="flex items-baseline">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Performance grid
// ---------------------------------------------------------------------------

function WalletPerformance({ summary }: { summary: WalletPnlSummary }) {
  const { t } = useTranslation();

  const metrics: { label: string; value: string; color?: string }[] = [
    {
      label: t("extend.leaderboard.perf.sevenDayVolume"),
      value: formatUsd(summary.sevenDayVolume),
    },
    {
      label: t("extend.leaderboard.perf.realizedPnl"),
      value: formatSignedUsd(summary.realizedPnl),
      color: pnlColorClass(summary.realizedPnl),
    },
    {
      label: t("extend.leaderboard.perf.unrealizedPnl"),
      value: formatSignedUsd(summary.unrealizedPnl),
      color: pnlColorClass(summary.unrealizedPnl),
    },
    {
      label: t("extend.leaderboard.perf.markets"),
      value: String(summary.marketCount),
    },
    {
      label: t("extend.leaderboard.perf.avgInitialCost"),
      value: formatUsd(summary.avgInitialCost),
    },
    {
      label: t("extend.leaderboard.perf.avgHoldTime"),
      value: formatHoldingTime(summary.avgHoldingSeconds),
    },
    {
      label: t("extend.leaderboard.perf.bestTrade"),
      value: formatSignedUsd(summary.bestTradePnl),
      color: pnlColorClass(summary.bestTradePnl),
    },
    {
      label: t("extend.leaderboard.perf.worstTrade"),
      value: formatSignedUsd(summary.worstTradePnl),
      color: pnlColorClass(summary.worstTradePnl),
    },
  ];

  return (
    <section>
      <SectionTitle>{t("extend.leaderboard.perf.title")}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-3"
          >
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {m.label}
            </div>
            <div className={cn("text-sm font-semibold tabular-nums text-white", m.color)}>
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Yield & Risk (collapsible)
// ---------------------------------------------------------------------------

function YieldRiskPanel({ summary }: { summary: WalletPnlSummary }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const metrics: { label: string; value: string }[] = [
    {
      label: t("extend.leaderboard.yieldRisk.profitFactor"),
      value: summary.profitFactor > 0 ? summary.profitFactor.toFixed(2) : "—",
    },
    {
      label: t("extend.leaderboard.yieldRisk.settlementWinRate"),
      value: formatRate(summary.settlementWinRate),
    },
    {
      label: t("extend.leaderboard.yieldRisk.settlementRatio"),
      value: formatRate(summary.settlementRatio),
    },
    {
      label: t("extend.leaderboard.yieldRisk.avgEntryCount"),
      value: summary.avgEntryCount > 0 ? summary.avgEntryCount.toFixed(1) : "—",
    },
  ];

  return (
    <section className="rounded-xl border border-zinc-800/40 bg-zinc-900/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {t("extend.leaderboard.yieldRisk.title")}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("text-zinc-500 transition-transform", open && "rotate-180")}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                {m.label}
              </div>
              <div className="text-sm font-semibold tabular-nums text-white">
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Positions / Closed / Activity tabs
// ---------------------------------------------------------------------------

function WalletPositionsTabs({
  wallet,
  detail,
}: {
  wallet: string;
  detail: WalletPnlDetail;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DetailTab>("positions");

  const tabs: { key: DetailTab; label: string; count?: number }[] = [
    {
      key: "positions",
      label: t("extend.leaderboard.tabs.positions"),
      count: detail.positions.length,
    },
    {
      key: "closed",
      label: t("extend.leaderboard.tabs.closed"),
      count: detail.closed.length,
    },
    { key: "activity", label: t("extend.leaderboard.tabs.activity") },
  ];

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-zinc-800/50">
        <div className="flex gap-0">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={cn(
                "cursor-pointer whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-all",
                tab === tb.key
                  ? "border-bullish text-bullish"
                  : "border-transparent text-zinc-400 hover:text-zinc-300",
              )}
            >
              {tb.label}
              {tb.count != null && tb.count > 0 && (
                <span className="ml-1 text-zinc-500">({tb.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col pt-3">
        {tab === "positions" && (
          <PositionsList positions={detail.positions} open />
        )}
        {tab === "closed" && <PositionsList positions={detail.closed} />}
        {tab === "activity" && <ActivityList wallet={wallet} />}
      </div>
    </section>
  );
}

function PositionsList({
  positions,
  open = false,
}: {
  positions: WalletTokenPnl[];
  open?: boolean;
}) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: positions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  if (positions.length === 0) {
    return (
      <EmptyBlock
        fill
        message={t(
          open ? "extend.leaderboard.noPositions" : "extend.leaderboard.noClosed",
        )}
      />
    );
  }

  return (
    <div
      ref={parentRef}
      className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-zinc-800/40 bg-zinc-900/20"
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const p = positions[vItem.index];
          return (
            <div
              key={p.tokenId}
              ref={virtualizer.measureElement}
              data-index={vItem.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${vItem.start}px)` }}
            >
              <PositionRow
                position={p}
                open={open}
                last={vItem.index === positions.length - 1}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PositionRow({
  position,
  open,
  last,
}: {
  position: WalletTokenPnl;
  open: boolean;
  last: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        !last && "border-b border-zinc-800/40",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-sm font-medium text-zinc-100">
          {position.marketQuestion || "—"}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
          {position.outcome && (
            <span className="rounded bg-zinc-800/60 px-1.5 py-0.5 font-medium text-zinc-300">
              {position.outcome}
            </span>
          )}
          {open ? (
            <span>
              {t("extend.leaderboard.pos.avgEntry")} {formatPrice(position.avgEntryPrice)}
              {" · "}
              {t("extend.leaderboard.pos.last")} {formatPrice(position.lastPrice)}
            </span>
          ) : (
            <span>
              {t("extend.leaderboard.pos.avgEntry")} {formatPrice(position.avgEntryPrice)}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {open ? (
          <>
            <div className="text-sm font-semibold tabular-nums text-white">
              {formatUsd(position.currentValue)}
            </div>
            <div className={cn("mt-0.5 text-xs font-medium tabular-nums", pnlColorClass(position.totalPnl))}>
              {formatSignedUsd(position.totalPnl)}
            </div>
          </>
        ) : (
          <div className={cn("text-sm font-semibold tabular-nums", pnlColorClass(position.realizedPnl))}>
            {formatSignedUsd(position.realizedPnl)}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityList({ wallet }: { wallet: string }) {
  const { t } = useTranslation();
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWalletActivities(wallet);

  const activities = data?.pages.flatMap((p) => p.activities) ?? [];

  // Append one extra "loader" row when more pages exist so the infinite fetch
  // trigger lives inside the virtualized list.
  const count = activities.length + (hasNextPage ? 1 : 0);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Fetch the next page once the loader row (last index) scrolls into view.
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (
      last.index >= activities.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [virtualItems, activities.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <DetailRowsSkeleton />;

  if (activities.length === 0) {
    return <EmptyBlock fill message={t("extend.leaderboard.noActivity")} />;
  }

  return (
    <div
      ref={parentRef}
      className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-zinc-800/40 bg-zinc-900/20"
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((vItem) => {
          const isLoaderRow = vItem.index >= activities.length;
          const a = activities[vItem.index];
          return (
            <div
              key={isLoaderRow ? "loader" : a.activityId ?? `${a.activityTs}-${vItem.index}`}
              ref={virtualizer.measureElement}
              data-index={vItem.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${vItem.start}px)` }}
            >
              {isLoaderRow ? (
                <div className="flex items-center justify-center px-4 py-4 text-xs text-zinc-500">
                  {t("extend.leaderboard.loading")}
                </div>
              ) : (
                <ActivityRow activity={a} last={vItem.index === activities.length - 1} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Localized label + colour for a trade activity type (buy / sell / redeem). */
type ActivityTypeLabelKey =
  | "extend.leaderboard.activity.buy"
  | "extend.leaderboard.activity.sell"
  | "extend.leaderboard.activity.redeem";

function activityTypeMeta(type: string): {
  key: ActivityTypeLabelKey;
  className: string;
} {
  const lower = type.toLowerCase();
  if (lower === "sell") {
    return { key: "extend.leaderboard.activity.sell", className: "bg-bearish/10 text-bearish" };
  }
  if (lower === "redeem") {
    return { key: "extend.leaderboard.activity.redeem", className: "bg-primary/10 text-primary" };
  }
  return { key: "extend.leaderboard.activity.buy", className: "bg-bullish/10 text-bullish" };
}

function ActivityRow({ activity, last }: { activity: WalletActivity; last: boolean }) {
  const { t } = useTranslation();
  const meta = activityTypeMeta(activity.type);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        !last && "border-b border-zinc-800/40",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-sm font-medium text-zinc-100">
          {activity.marketQuestion || activity.outcome || "—"}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
          <span className={cn("rounded px-1.5 py-0.5 font-medium", meta.className)}>
            {t(meta.key)}
          </span>
          {activity.outcome && <span className="text-zinc-400">{activity.outcome}</span>}
          <span>
            {formatPrice(activity.price)} · {activity.quantity.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-white">
        {formatUsd(activity.amount)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
      {children}
    </h3>
  );
}

function EmptyBlock({ message, fill }: { message: string; fill?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border border-zinc-800/40 bg-zinc-900/20",
        fill ? "min-h-0 flex-1" : "py-12",
      )}
    >
      <span className="text-sm text-zinc-500">{message}</span>
    </div>
  );
}
