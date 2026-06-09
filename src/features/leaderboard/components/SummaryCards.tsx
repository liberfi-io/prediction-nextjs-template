"use client";

/**
 * Reusable wallet summary cards: TOTAL VALUE, PERFORMANCE & BIAS and YIELD &
 * RISK. Extracted from {@link WalletDetailPanel} so both the Smart Money detail
 * view and the user's own portfolio page can render the same panels off a
 * {@link WalletPnlSummary}. All formatting goes through `../format`.
 */

import { useMemo } from "react";
import Link from "next/link";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTickAge } from "@liberfi.io/hooks";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import { useWalletDailyPnl, useWalletPositions } from "../data/queries";
import {
  formatAgeMs,
  formatPercent,
  formatRate,
  formatSignedUsd,
  formatUsd,
  parseTimestampMs,
  pnlColorClass,
} from "../format";
import type {
  LeaderboardInterval,
  WalletDailyPnl,
  WalletPnlSummary,
  WalletTokenPnl,
} from "../types";

const EMPTY_VALUE = "N/A";

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
          {summary.avgEntryCount > 0 ? summary.avgEntryCount.toFixed(2) : EMPTY_VALUE}
        </span>
      ),
    },
    {
      label: t("extend.leaderboard.detail.lastActive"),
      value: <LiveAge ts={summary.lastActivityTs} className="text-white" />,
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

function LiveAge({
  ts,
  className,
}: {
  ts?: string | number | null;
  className?: string;
}) {
  const timestampMs = parseTimestampMs(ts);
  const ageMs = useTickAge(timestampMs ?? Date.now());
  return <span className={className}>{timestampMs == null ? EMPTY_VALUE : formatAgeMs(ageMs)}</span>;
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
      value: summary.profitFactor > 0 ? summary.profitFactor.toFixed(2) : EMPTY_VALUE,
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

/** Plot-area height (px) for the 7-day PNL sparkline. */
const DAILY_CHART_HEIGHT = 96;

/** Line color (theme `--color-bullish`). */
const PNL_BULLISH = "#c7ff2e";

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
  const { i18n } = useTranslation();
  const locale = i18n.language || undefined;
  const color = PNL_BULLISH;
  const data = useMemo(() => buildDailySeries(dailyPnls, locale), [dailyPnls, locale]);

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

  if (isError || data.length === 0) {
    return null;
  }

  // Pad the value domain so a near-flat series isn't pinned to an edge and the
  // zero baseline stays visible. Always include 0 so the reference line shows.
  const values = data.map((d) => d.pnl);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const pad = (max - min) * 0.15 || 1;

  // Only label the 1st, 4th and 7th day on the x axis.
  const xTicks = [0, 3, 6]
    .filter((i) => i < data.length)
    .map((i) => data[i].label);

  return (
    <div className="mt-4 border-t border-zinc-800/60 pt-3">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="select-none" style={{ height: DAILY_CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 18, bottom: 0, left: 18 }}>
            {/* Y axis hidden (no ticks/lines) but still establishes the scale. */}
            <YAxis hide domain={[min - pad, max + pad]} />
            <XAxis
              dataKey="label"
              ticks={xTicks}
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickMargin={6}
              axisLine={false}
              tickLine={false}
              height={20}
              interval="preserveStartEnd"
              minTickGap={0}
            />
            <ReferenceLine y={0} stroke="#3f3f46" strokeWidth={1} />
            <Tooltip
              cursor={{ stroke: "#52525b", strokeWidth: 1, strokeDasharray: "4 4" }}
              isAnimationActive={false}
              wrapperStyle={{ zIndex: 2, outline: "none" }}
              content={<DailyPnlTooltip />}
            />
            <Line
              type="monotone"
              dataKey="pnl"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "rgba(10,10,11,0.85)", fill: color }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface DailyPoint {
  /** ISO day (yyyy-mm-dd), used as a stable key. */
  day: string;
  /** Short axis/category label, e.g. "Jun 5". */
  label: string;
  /** Richer date shown in the tooltip, e.g. "Fri, Jun 5". */
  fullLabel: string;
  /** Realized PNL for the day (interpolated when the day is missing). */
  pnl: number;
}

/** Tooltip payload shape we read off recharts (only the row payload is used). */
interface DailyPnlTooltipProps {
  active?: boolean;
  payload?: { payload: DailyPoint }[];
}

function DailyPnlTooltip({ active, payload }: DailyPnlTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="mb-1 font-medium text-zinc-400">{row.fullLabel}</div>
      <div className={cn("font-semibold tabular-nums", pnlColorClass(row.pnl))}>
        {formatSignedUsd(row.pnl)}
      </div>
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

const DAY_MS = 86_400_000;

/**
 * Build a continuous 7-day realized-PNL series for the chart.
 *
 * The API may return fewer than 7 days (days with no PNL record are omitted),
 * so we anchor a 7-day window on the latest day present and fill any missing
 * day by linearly interpolating between its nearest known neighbors (flat
 * carry at the leading/trailing edges). The result is always 7 evenly-spaced
 * points so the line never collapses or skips days.
 */
function buildDailySeries(dailyPnls: WalletDailyPnl[], locale?: string): DailyPoint[] {
  const known = dailyPnls
    .map((p) => ({ ts: Date.parse(`${p.day}T00:00:00Z`), pnl: p.realizedPnl }))
    .filter((p) => Number.isFinite(p.ts))
    .sort((a, b) => a.ts - b.ts);
  if (known.length === 0) return [];

  const byTs = new Map<number, number>();
  for (const k of known) byTs.set(k.ts, k.pnl);

  const end = known[known.length - 1].ts;
  const start = end - 6 * DAY_MS;

  const points: DailyPoint[] = [];
  for (let i = 0; i < 7; i += 1) {
    const ts = start + i * DAY_MS;
    const pnl = byTs.has(ts) ? (byTs.get(ts) as number) : interpolatePnl(ts, known);
    points.push({
      day: new Date(ts).toISOString().slice(0, 10),
      label: formatDayLabel(ts, false, locale),
      fullLabel: formatDayLabel(ts, true, locale),
      pnl,
    });
  }
  return points;
}

/**
 * Linear interpolation of realized PNL at `ts` from the sorted known points.
 * Falls back to flat carry when only one side exists (leading/trailing edge).
 */
function interpolatePnl(ts: number, known: { ts: number; pnl: number }[]): number {
  let prev: { ts: number; pnl: number } | null = null;
  let next: { ts: number; pnl: number } | null = null;
  for (const k of known) {
    if (k.ts <= ts) prev = k;
    if (k.ts >= ts && next === null) next = k;
  }
  if (prev && next) {
    if (next.ts === prev.ts) return prev.pnl;
    const r = (ts - prev.ts) / (next.ts - prev.ts);
    return prev.pnl + (next.pnl - prev.pnl) * r;
  }
  return (prev ?? next as { ts: number; pnl: number }).pnl;
}

/**
 * Format a UTC day timestamp in the active UI language; the tooltip variant
 * adds the weekday.
 */
function formatDayLabel(ts: number, withWeekday: boolean, locale?: string): string {
  return new Date(ts).toLocaleDateString(locale, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withWeekday ? { weekday: "short" } : null),
  });
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
