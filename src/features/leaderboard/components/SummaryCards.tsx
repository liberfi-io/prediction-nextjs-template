"use client";

/**
 * Reusable wallet summary cards: TOTAL VALUE, PERFORMANCE & BIAS and YIELD &
 * RISK. Extracted from {@link WalletDetailPanel} so both the Smart Money detail
 * view and the user's own portfolio page can render the same panels off a
 * {@link WalletPnlSummary}. All formatting goes through `../format`.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import { useWalletDailyPnl, useWalletPositions } from "../data/queries";
import {
  formatPercent,
  formatRate,
  formatRelativeTime,
  formatSignedUsd,
  formatUsd,
  pnlColorClass,
} from "../format";
import type {
  LeaderboardInterval,
  WalletDailyPnl,
  WalletPnlSummary,
  WalletTokenPnl,
} from "../types";

// ---------------------------------------------------------------------------
// Card 1 — TOTAL VALUE
// ---------------------------------------------------------------------------

export function TotalValueCard({
  summary,
  wallet,
  interval,
  tag,
}: {
  summary: WalletPnlSummary;
  wallet?: string;
  interval?: LeaderboardInterval;
  tag?: string | null;
}) {
  const { t } = useTranslation();
  const { data, isError, isLoading } = useWalletDailyPnl(wallet, interval, tag);

  return (
    <Card title={t("extend.leaderboard.detail.totalValue")}>
      <div className="space-y-2">
        <MiniStat
          label={t("extend.leaderboard.detail.netValue")}
          value={
            <span className="text-base font-bold text-white">
              {formatUsd(summary.currentValue)}
            </span>
          }
        />
        <MiniStat
          label={t("extend.leaderboard.detail.todayPnl")}
          value={
            <span className={pnlColorClass(summary.todayRealizedPnl)}>
              {formatSignedUsd(summary.todayRealizedPnl)}
            </span>
          }
        />
        <MiniStat
          label={t("extend.leaderboard.detail.sevenDayPnl")}
          value={
            <span className={pnlColorClass(summary.sevenDayRealizedPnl)}>
              {formatSignedUsd(summary.sevenDayRealizedPnl)}
            </span>
          }
        />
        <MiniStat
          label={t("extend.leaderboard.detail.totalPnl")}
          value={
            <span className={cn("inline-flex items-baseline gap-4", pnlColorClass(summary.totalPnl))}>
              <span className="text-xs font-medium">
                {formatPercent(summary.totalPnlRatio)}
              </span>
              <span>{formatSignedUsd(summary.totalPnl)}</span>
            </span>
          }
        />
      </div>
      {wallet && (
        <SevenDayPnlChart
          dailyPnls={data?.dailyPnls ?? []}
          isError={isError}
          isLoading={isLoading}
          label={t("extend.leaderboard.detail.sevenDayPnl")}
        />
      )}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card 2 — PERFORMANCE & BIAS
// ---------------------------------------------------------------------------

export function PerformanceBiasCard({ summary }: { summary: WalletPnlSummary }) {
  const { t } = useTranslation();

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: t("extend.leaderboard.detail.txs"),
      value: (
        <span className="tabular-nums text-white">
          <span className="text-bullish">{summary.winCount}</span>
          <span className="text-zinc-600"> / </span>
          <span className="text-bearish">{summary.lossCount}</span>
        </span>
      ),
    },
    {
      label: t("extend.leaderboard.detail.todayVol"),
      value: <span className="text-white">{formatUsd(summary.todayVolume)}</span>,
    },
    {
      label: t("extend.leaderboard.detail.vol7d"),
      value: <span className="text-white">{formatUsd(summary.sevenDayVolume)}</span>,
    },
    {
      label: t("extend.leaderboard.detail.realizedPnl"),
      value: (
        <span className={pnlColorClass(summary.realizedPnl)}>
          {formatSignedUsd(summary.realizedPnl)}
        </span>
      ),
    },
    {
      label: t("extend.leaderboard.detail.currentPnl"),
      value: (
        <span className={pnlColorClass(summary.unrealizedPnl)}>
          {formatSignedUsd(summary.unrealizedPnl)}
        </span>
      ),
    },
    {
      label: t("extend.leaderboard.detail.marketCount"),
      value: <span className="text-white">{summary.marketCount}</span>,
    },
    {
      label: t("extend.leaderboard.detail.avgInitialCost"),
      value: <span className="text-white">{formatUsd(summary.avgInitialCost)}</span>,
    },
    {
      label: t("extend.leaderboard.detail.avgScaleIn"),
      value: (
        <span className="text-white">
          {summary.avgEntryCount > 0 ? summary.avgEntryCount.toFixed(2) : "—"}
        </span>
      ),
    },
    {
      label: t("extend.leaderboard.detail.lastActive"),
      value: <span className="text-white">{formatRelativeTime(summary.lastActivityTs)}</span>,
    },
  ];

  return (
    <Card title={t("extend.leaderboard.detail.performanceBias")}>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">{r.label}</span>
            <span className="text-sm font-semibold tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card 3 — YIELD & RISK
// ---------------------------------------------------------------------------

export function YieldRiskCard({
  summary,
  wallet,
  interval,
  requestTag,
  tag,
}: {
  summary: WalletPnlSummary;
  wallet: string;
  interval?: LeaderboardInterval;
  requestTag?: string | null;
  tag: string;
}) {
  const { t } = useTranslation();
  // Pull the first positions page just to compute the exposure mix; the tab
  // body fetches/manages the full paginated list separately.
  const { data } = useWalletPositions(wallet, undefined, undefined, interval, requestTag);
  const exposure = useMemo(
    () => buildExposure(data?.pages.flatMap((p) => p.tokens) ?? [], tag),
    [data, tag],
  );

  const metrics: { label: string; value: string }[] = [
    {
      label: t("extend.leaderboard.detail.winRate"),
      value: formatRate(summary.winRate),
    },
    {
      label: t("extend.leaderboard.detail.profitFactor"),
      value: summary.profitFactor > 0 ? summary.profitFactor.toFixed(2) : "—",
    },
    {
      label: t("extend.leaderboard.detail.settlementWinRate"),
      value: formatRate(summary.settlementWinRate),
    },
    {
      label: t("extend.leaderboard.detail.settledRatio"),
      value: formatRate(summary.settlementRatio),
    },
  ];

  return (
    <Card title={t("extend.leaderboard.detail.yieldRisk")}>
      <div className="grid grid-cols-2 gap-3">
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

      <TradeHighlight
        label={t("extend.leaderboard.detail.bestTrade")}
        marketQuestion={summary.bestTradeMarketQuestion}
        eventSlug={summary.bestTradeEventSlug}
        pnl={summary.bestTradePnl}
      />
      <TradeHighlight
        label={t("extend.leaderboard.detail.worstTrade")}
        marketQuestion={summary.worstTradeMarketQuestion}
        eventSlug={summary.worstTradeEventSlug}
        pnl={summary.worstTradePnl}
      />

      {exposure.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {t("extend.leaderboard.detail.exposure")}
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-zinc-800/60">
            {exposure.map((e, i) => (
              <div
                key={e.label}
                className={EXPOSURE_COLORS[i % EXPOSURE_COLORS.length]}
                style={{ width: `${(e.ratio * 100).toFixed(1)}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {exposure.map((e, i) => (
              <span key={e.label} className="flex items-center gap-1 text-[11px] text-zinc-400">
                <span
                  className={cn(
                    "size-2 rounded-sm",
                    EXPOSURE_COLORS[i % EXPOSURE_COLORS.length],
                  )}
                />
                <span className="max-w-[90px] truncate">{e.label}</span>
                <span className="tabular-nums text-zinc-500">
                  {(e.ratio * 100).toFixed(1)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function SevenDayPnlChart({
  dailyPnls,
  isError,
  isLoading,
  label,
}: {
  dailyPnls: WalletDailyPnl[];
  isError: boolean;
  isLoading: boolean;
  label: string;
}) {
  const points = useMemo(() => buildChartPoints(dailyPnls), [dailyPnls]);
  const lastPnl = dailyPnls.at(-1)?.realizedPnl ?? 0;
  const stroke = lastPnl > 0 ? "stroke-bullish" : lastPnl < 0 ? "stroke-bearish" : "stroke-zinc-400";

  if (isLoading) {
    return (
      <div className="mt-4 border-t border-zinc-800/60 pt-3">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </div>
        <div className="h-24 animate-pulse rounded-lg bg-zinc-800/40" />
      </div>
    );
  }

  if (isError || points.items.length === 0) {
    return null;
  }

  const zeroY = points.zeroY;

  return (
    <div className="mt-4 border-t border-zinc-800/60 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </div>
        <div className={cn("text-xs font-semibold tabular-nums", pnlColorClass(lastPnl))}>
          {formatSignedUsd(lastPnl)}
        </div>
      </div>
      <svg
        viewBox="0 0 100 92"
        role="img"
        aria-label={label}
        className="h-24 w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          x2="100"
          y1={zeroY}
          y2={zeroY}
          className="stroke-zinc-800"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={points.path}
          fill="none"
          className={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.items.map((point) => (
          <circle
            key={point.day}
            cx={point.x}
            cy={point.y}
            r="1.6"
            className={cn("fill-zinc-950", stroke)}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          >
            <title>
              {point.day} {formatSignedUsd(point.realizedPnl)}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function TradeHighlight({
  label,
  marketQuestion,
  eventSlug,
  pnl,
}: {
  label: string;
  marketQuestion?: string;
  eventSlug?: string;
  pnl: number;
}) {
  if (!marketQuestion) return null;

  return (
    <div className="mt-3 border-t border-zinc-800/60 pt-3">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <EventTitleLink
        slug={eventSlug}
        className="line-clamp-1 text-xs text-zinc-300"
      >
        {marketQuestion}
      </EventTitleLink>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", pnlColorClass(pnl))}>
        {formatSignedUsd(pnl)}
      </div>
    </div>
  );
}

function buildChartPoints(dailyPnls: WalletDailyPnl[]): {
  items: (WalletDailyPnl & { x: number; y: number })[];
  path: string;
  zeroY: number;
} {
  const values = dailyPnls.map((p) => p.realizedPnl);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const top = 8;
  const height = 76;
  const items = dailyPnls.map((p, i) => {
    const x = dailyPnls.length === 1 ? 50 : (i / (dailyPnls.length - 1)) * 100;
    const y = top + ((max - p.realizedPnl) / range) * height;
    return { ...p, x, y };
  });
  const zeroY = top + ((max - 0) / range) * height;
  return {
    items,
    path: smoothPath(items),
    zeroY,
  };
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const midX = (prev.x + cur.x) / 2;
    const midY = (prev.y + cur.y) / 2;
    path += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  path += ` T ${last.x} ${last.y}`;
  return path;
}

const EXPOSURE_COLORS = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-fuchsia-500",
];

/**
 * Aggregate position value by category tag (excluding the product tag and
 * opaque numeric ids). Returns the top categories by value share.
 */
function buildExposure(
  tokens: WalletTokenPnl[],
  productTag: string,
): { label: string; ratio: number }[] {
  const byTag = new Map<string, number>();
  let total = 0;
  for (const tk of tokens) {
    const value = Math.max(0, tk.currentValue);
    if (value <= 0) continue;
    const cats = tk.tags.filter(
      (tag) => tag && tag !== productTag && !/^\d+$/.test(tag),
    );
    if (cats.length === 0) continue;
    const cat = cats[0];
    byTag.set(cat, (byTag.get(cat) ?? 0) + value);
    total += value;
  }
  if (total <= 0) return [];
  const sorted = [...byTag.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 3);
  const rest = sorted.slice(3).reduce((s, [, v]) => s + v, 0);
  const out = top.map(([label, v]) => ({ label, ratio: v / total }));
  if (rest > 0) out.push({ label: "Others", ratio: rest / total });
  return out;
}

// ---------------------------------------------------------------------------
// Shared card primitives
// ---------------------------------------------------------------------------

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function EventTitleLink({
  slug,
  className,
  children,
}: {
  slug?: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!slug) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link
      href={`/polymarket/${slug}`}
      prefetch={false}
      onClick={(e) => e.stopPropagation()}
      className={cn(className, "transition-colors hover:text-white hover:underline")}
    >
      {children}
    </Link>
  );
}
