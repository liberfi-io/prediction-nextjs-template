"use client";

/**
 * Wallet detail — the right detail column of the Smart Money master-detail
 * layout (full-screen slide-over on mobile).
 *
 * Layout mirrors a portfolio profile page: a wallet header, three summary
 * cards (TOTAL VALUE with a daily sparkline, PERFORMANCE & BIAS, YIELD & RISK
 * with a category exposure bar) and the POSITIONS / SETTLED / ACTIVITY tabs.
 *
 * The whole panel scrolls as one surface; the active tab's list is virtualized
 * against that scroll surface via `scrollMargin` so the cards scroll away
 * naturally on mobile while long lists stay cheap. Summary comes from
 * {@link useWalletPnl}; the chart uses /pnl/daily; positions come from the
 * paginated {@link useWalletPositions}; activities from
 * {@link useWalletActivities}. All formatting goes through
 * `../format`.
 */

import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTickAge } from "@liberfi.io/hooks";
import { useTranslation } from "@liberfi.io/i18n";
import { cn, Sortable } from "@liberfi.io/ui";
import { CopyInline } from "../../../components/CopyButton";
import { GradientAvatar } from "../../../components/GradientAvatar";
import {
  useWalletActivities,
  useWalletPnl,
  useWalletPositions,
} from "../data/queries";
import {
  formatPercent,
  formatAgeMs,
  formatPrice,
  formatRelativeTime,
  formatSignedUsd,
  formatUsd,
  parseTimestampMs,
  pnlColorClass,
  shortAddress,
} from "../format";
import type {
  LeaderboardInterval,
  PositionSortField,
  PositionStatus,
  SortOrder,
  WalletActivity,
  WalletPnlSummary,
  WalletTokenPnl,
} from "../types";
import {
  EventTitleLink,
  PerformanceBiasCard,
  TotalValueCard,
  YieldRiskCard,
} from "./SummaryCards";
import { PositionsTableSkeleton, WalletDetailSkeleton } from "./skeletons";

type DetailTab = "open" | "closed" | "activity";

/** Maps a positions tab to the backend `status` lifecycle filter. */
const TAB_STATUS: Record<"open" | "closed", PositionStatus> = {
  open: "holding",
  closed: "closed",
};

/** Estimated list row height (px) for the virtualizer's first paint. */
const ROW_ESTIMATE = 64;

/** Position table grid template (desktop). */
const TABLE_GRID =
  "grid-cols-[minmax(160px,1.7fr)_44px_64px_96px_80px_96px_88px_88px_78px_62px]";

function transText(trans: string | undefined, base: string | undefined): string {
  return trans || base || "";
}

export function WalletDetailPanel({
  wallet,
  interval,
  tag,
  onBack,
}: {
  wallet: string;
  interval: LeaderboardInterval;
  tag?: string | null;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useWalletPnl(wallet, interval, tag);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (isLoading) return <WalletDetailSkeleton onBack={onBack} />;

  if (isError || !data) {
    return (
      <div className="flex h-full flex-col gap-4">
        <WalletHeader wallet={wallet} onBack={onBack} />
        <EmptyBlock message={t("extend.leaderboard.loadError")} fill />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto overflow-x-hidden no-scrollbar"
      >
        <div className="flex flex-col gap-4 pb-4">
          <WalletHeader wallet={wallet} summary={data.summary} onBack={onBack} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <TotalValueCard summary={data.summary} wallet={wallet} interval={interval} tag={tag} />
            <PerformanceBiasCard summary={data.summary} />
            <YieldRiskCard summary={data.summary} wallet={wallet} interval={interval} requestTag={tag} tag={data.tag} />
          </div>
          <WalletTabs
            wallet={wallet}
            summary={data.summary}
            interval={interval}
            tag={tag}
            scrollRef={scrollRef}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function WalletHeader({
  wallet,
  summary,
  onBack,
}: {
  wallet: string;
  summary?: WalletPnlSummary;
  onBack?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={t("extend.leaderboard.back")}
          title={t("extend.leaderboard.back")}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      )}
      <GradientAvatar seed={wallet} size={44} className="!rounded-xl" />
      <div className="min-w-0">
        <CopyInline value={wallet} title={t("extend.leaderboard.copy")} size={14}>
          <span className="truncate font-mono text-base font-semibold text-white">
            {shortAddress(wallet, 8, 6)}
          </span>
        </CopyInline>
        {summary && (
          <div className="mt-0.5 text-xs text-zinc-500">
            {summary.marketCount} {t("extend.leaderboard.col.markets")} ·{" "}
            {t("extend.leaderboard.detail.lastActive")}{" "}
            <WalletLastActiveAge ts={summary.lastActivityTs} />
          </div>
        )}
      </div>
    </div>
  );
}

function WalletLastActiveAge({ ts }: { ts?: string | number | null }) {
  const timestampMs = parseTimestampMs(ts);
  const ageMs = useTickAge(timestampMs ?? Date.now());
  return timestampMs == null ? "N/A" : formatAgeMs(ageMs);
}

// ---------------------------------------------------------------------------
// Tabs + table
// ---------------------------------------------------------------------------

function WalletTabs({
  wallet,
  summary,
  interval,
  tag,
  scrollRef,
}: {
  wallet: string;
  summary: WalletPnlSummary;
  interval: LeaderboardInterval;
  tag?: string | null;
  scrollRef: RefObject<HTMLDivElement>;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DetailTab>("open");
  const [query, setQuery] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const repinScrollRef = useRef(false);

  // Switching tabs swaps the list body for a shorter loading / short list, so
  // the single-scroll panel's content height collapses. The browser then
  // clamps the now out-of-range scroll position — on mobile, where the stacked
  // header + cards are taller than the viewport, it drops all the way to the
  // top and the tab bar + new list fall below the fold ("tabs disappear").
  // Flag a user-initiated switch and re-pin the scroll afterwards in
  // `useLayoutEffect`.
  const selectTab = (key: DetailTab) => {
    if (key !== tab) repinScrollRef.current = true;
    setTab(key);
  };

  // After the new tab's body commits, pin the scroll so the tab bar stays as
  // high as the (possibly shorter) content allows, overriding the browser's
  // collapse-time scroll clamp. When the content fits without scrolling the
  // target is 0 (no-op), so this never disturbs short / desktop layouts. Re-pin
  // on the next frame too, since the body height settles a frame after commit.
  useLayoutEffect(() => {
    if (!repinScrollRef.current) return;
    repinScrollRef.current = false;
    const scroller = scrollRef.current;
    const section = sectionRef.current;
    if (!scroller || !section) return;
    const pin = () => {
      const sectionTop =
        section.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const target = Math.min(sectionTop, maxScroll);
      if (Math.abs(scroller.scrollTop - target) > 1) scroller.scrollTo({ top: target });
    };
    pin();
    const raf = requestAnimationFrame(pin);
    return () => cancelAnimationFrame(raf);
  }, [tab]);
  // Single active sort column; `null` = unsorted (backend default order), which
  // is the initial state. Mirrors the ui-tokens Sortable interaction
  // (undefined → desc → asc → undefined).
  const [sort, setSort] = useState<{
    field: PositionSortField;
    order: SortOrder;
  } | null>(null);

  const tabs: { key: DetailTab; label: string; count?: number }[] = [
    { key: "open", label: t("extend.leaderboard.detail.tabs.open"), count: summary.openPositionCount },
    { key: "closed", label: t("extend.leaderboard.detail.tabs.closed") },
    { key: "activity", label: t("extend.leaderboard.tabs.activity") },
  ];

  return (
    <section ref={sectionRef} className="flex flex-col">
      <div className="sticky top-0 z-10 -mx-px bg-[#0a0a0b]/95 pb-2 pt-1 backdrop-blur">
        <div className="flex flex-col gap-2 border-b border-zinc-800/50 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => selectTab(tb.key)}
                className={cn(
                  "cursor-pointer whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-all",
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
          {tab !== "activity" && (
            <div className="max-sm:px-2 sm:contents">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("extend.leaderboard.detail.searchMarkets")}
                className="mb-1.5 w-full rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-700 sm:w-auto sm:min-w-[140px] sm:max-w-[220px] sm:flex-1"
              />
            </div>
          )}
        </div>
      </div>

      <div className="pt-3">
        {tab === "activity" ? (
          <ActivityList
            wallet={wallet}
            query={query}
            interval={interval}
            tag={tag}
            scrollRef={scrollRef}
          />
        ) : (
          <PositionsTable
            wallet={wallet}
            tab={tab}
            query={query}
            sort={sort}
            onSort={setSort}
            interval={interval}
            tag={tag}
            scrollRef={scrollRef}
          />
        )}
      </div>
    </section>
  );
}

/**
 * Window-style virtualizer bound to the panel's scroll surface. Tracks the
 * list wrapper's offset within the scroll element as `scrollMargin`.
 */
function useWindowList(
  scrollRef: RefObject<HTMLElement>,
  count: number,
  deps: unknown[],
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      const scroller = scrollRef.current;
      if (!wrap || !scroller) return;
      const offset =
        wrap.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      setScrollMargin((prev) => (Math.abs(prev - offset) > 1 ? offset : prev));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    scrollMargin,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  return { wrapRef, virtualizer, scrollMargin };
}

function PositionsTable({
  wallet,
  tab,
  query,
  sort,
  onSort,
  interval,
  tag,
  scrollRef,
}: {
  wallet: string;
  tab: "open" | "closed";
  query: string;
  sort: { field: PositionSortField; order: SortOrder } | null;
  onSort: (s: { field: PositionSortField; order: SortOrder } | null) => void;
  interval: LeaderboardInterval;
  tag?: string | null;
  scrollRef: RefObject<HTMLDivElement>;
}) {
  const { t } = useTranslation();
  const {
    data,
    isLoading,
    isPlaceholderData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWalletPositions(wallet, sort?.field, sort?.order, interval, tag, TAB_STATUS[tab]);

  // Cycle a column through desc → asc → unsorted (ui-tokens Sortable contract).
  const handleSort =
    (field: PositionSortField) => (dir: "asc" | "desc" | undefined) => {
      onSort(dir ? { field, order: dir } : null);
    };
  const sortFor = (field: PositionSortField): SortOrder | undefined =>
    sort?.field === field ? sort.order : undefined;

  // The backend already filters by lifecycle status (holding / closed); only
  // the local market-question search is applied client-side.
  const allTokens = data?.pages.flatMap((p) => p.tokens) ?? [];
  const q = query.trim().toLowerCase();
  const rows = q
    ? allTokens.filter((tk) =>
        transText(tk.marketQuestionTrans, tk.marketQuestion)
          .toLowerCase()
          .includes(q),
      )
    : allTokens;

  const count = rows.length + (hasNextPage ? 1 : 0);
  const { wrapRef, virtualizer, scrollMargin } = useWindowList(scrollRef, count, [
    rows.length,
    hasNextPage,
    tab,
    sort?.field,
    sort?.order,
  ]);
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= rows.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualItems, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Show the skeleton both on first load and whenever the sort switches to a
  // not-yet-cached order (placeholder data from the previous sort would
  // otherwise linger, making the switch feel unresponsive). Pagination keeps
  // the same query key, so it never trips this.
  if (isLoading || isPlaceholderData) return <PositionsTableSkeleton />;
  if (rows.length === 0) {
    return (
      <EmptyBlock
        message={t(q ? "extend.leaderboard.detail.noResults" : "extend.leaderboard.noPositions")}
      />
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/20">
      <div className="overflow-x-auto lg:overflow-x-visible">
        <div className="min-w-[920px] lg:min-w-0">
          {/* Column header — same column layout across breakpoints. On desktop
              (lg+) the table shrinks to fit the available width; below lg it keeps
              a fixed min width and the box scrolls horizontally. */}
          <div className={cn("grid", TABLE_GRID, "items-center gap-1.5 border-b border-zinc-800/50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500")}>
            <span>{t("extend.leaderboard.detail.colMarket")}</span>
            <span className="text-center">{t("extend.leaderboard.detail.colSide")}</span>
            <span className="text-right">{t("extend.leaderboard.detail.colShares")}</span>
            <span className="text-right">{t("extend.leaderboard.detail.colAvgNow")}</span>
            <span className="text-right">{t("extend.leaderboard.detail.colValue")}</span>
            <span className="flex justify-end">
              <Sortable sort={sortFor("totalPnl")} onSortChange={handleSort("totalPnl")}>
                {t("extend.leaderboard.detail.colTotalPnl")}
              </Sortable>
            </span>
            <span className="flex justify-end">
              <Sortable sort={sortFor("realizedPnl")} onSortChange={handleSort("realizedPnl")}>
                {t("extend.leaderboard.detail.colRealizedPnl")}
              </Sortable>
            </span>
            <span className="flex justify-end">
              <Sortable sort={sortFor("unrealizedPnl")} onSortChange={handleSort("unrealizedPnl")}>
                {t("extend.leaderboard.detail.colUnrealizedPnl")}
              </Sortable>
            </span>
            <span className="flex justify-end">
              <Sortable sort={sortFor("lastActive")} onSortChange={handleSort("lastActive")}>
                {t("extend.leaderboard.detail.colLastActive")}
              </Sortable>
            </span>
            <span className="text-right">{t("extend.leaderboard.detail.colStatus")}</span>
          </div>

          <div ref={wrapRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualItems.map((vItem) => {
              const isLoaderRow = vItem.index >= rows.length;
              const p = rows[vItem.index];
              return (
                <div
                  key={isLoaderRow ? "loader" : p.tokenId}
                  ref={virtualizer.measureElement}
                  data-index={vItem.index}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${vItem.start - scrollMargin}px)` }}
                >
                  {isLoaderRow ? (
                    <div className="flex items-center justify-center px-4 py-4 text-xs text-zinc-500">
                      {t("extend.leaderboard.loading")}
                    </div>
                  ) : (
                    <PositionRow position={p} last={vItem.index === rows.length - 1} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function positionStatus(p: WalletTokenPnl): "open" | "won" | "lost" {
  // Prefer the upstream lifecycle status; fall back to open_quantity on older
  // backends that don't yet emit `status`. Only chain-resolved ("settled") or
  // fully-closed positions get a won/lost verdict.
  const open = p.status ? p.status === "holding" : p.openQuantity > 0;
  if (open) return "open";
  return p.realizedPnl >= 0 ? "won" : "lost";
}

/**
 * Relative "time since" that re-renders every second so the value keeps
 * ticking live while the wallet detail stays open.
 */
function LiveRelativeTime({
  ts,
  className,
}: {
  ts?: string | number | null;
  className?: string;
}) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{formatRelativeTime(ts)}</span>;
}

/**
 * Market / event thumbnail. Renders the locally-enriched image URL when
 * prediction-server resolved one; otherwise falls back to a deterministic
 * gradient seeded by the market identifier (so the same market always looks the
 * same). Broken image URLs degrade to the same gradient.
 */
function MarketAvatar({
  src,
  seed,
  size = 32,
  className,
}: {
  src?: string;
  seed?: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("flex-shrink-0 rounded-lg bg-zinc-800 object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return <GradientAvatar seed={seed} size={size} className={className} />;
}

/**
 * Subtitle shown under a position's market question: the locally-enriched
 * (localized) event title when available, otherwise the de-slugified event
 * slug as a best-effort label.
 */
function positionSubtitle(position: WalletTokenPnl): string {
  const title = transText(position.eventTitleTrans, position.eventTitle);
  if (title) return title;
  if (position.eventSlug) return position.eventSlug.replace(/-/g, " ");
  return "";
}

/**
 * Wraps a market title in a link to its event detail page when the
 * locally-enriched event slug is available; otherwise renders plain text.
 * Smart-money data is Polymarket-sourced, so links use the unified event detail
 * route. `stopPropagation` keeps the link from triggering any enclosing
 * row-level click handlers.
 */
function PositionRow({ position, last }: { position: WalletTokenPnl; last: boolean }) {
  const { t } = useTranslation();
  const status = positionStatus(position);
  const statusMeta = {
    open: { label: t("extend.leaderboard.detail.status.open"), cls: "bg-zinc-700/40 text-zinc-300" },
    won: { label: t("extend.leaderboard.detail.status.won"), cls: "bg-bullish/15 text-bullish" },
    lost: { label: t("extend.leaderboard.detail.status.lost"), cls: "bg-bearish/15 text-bearish" },
  }[status];

  const sideMeta =
    position.outcome.toLowerCase() === "no"
      ? "bg-bearish/10 text-bearish"
      : "bg-bullish/10 text-bullish";
  const marketQuestion = transText(position.marketQuestionTrans, position.marketQuestion);
  const outcome = transText(position.outcomeTrans, position.outcome);

  return (
    <div className={cn("px-3 py-3", !last && "border-b border-zinc-800/40")}>
      <div className={cn("grid", TABLE_GRID, "items-center gap-1.5")}>
        <div className="flex min-w-0 items-center gap-2.5">
          <MarketAvatar
            src={position.marketImageUrl || position.eventImageUrl}
            seed={position.conditionId || position.tokenId || position.eventSlug}
            size={34}
          />
          <div className="min-w-0">
            <EventTitleLink
              slug={position.eventSlug}
              className="line-clamp-1 text-sm font-medium text-zinc-100"
            >
              {marketQuestion || "—"}
            </EventTitleLink>
            {positionSubtitle(position) && (
              <div className="line-clamp-1 text-[11px] uppercase tracking-wide text-zinc-600">
                {positionSubtitle(position)}
              </div>
            )}
          </div>
        </div>
        <div className="text-center">
          <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", sideMeta)}>
            {outcome || "—"}
          </span>
        </div>
        <div className="text-right text-sm tabular-nums text-zinc-300">
          {position.openQuantity.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </div>
        <div className="text-right text-xs tabular-nums text-zinc-400">
          {formatPrice(position.avgEntryPrice)}
          <span className="text-zinc-600"> → </span>
          {formatPrice(position.lastPrice)}
        </div>
        <div className="text-right text-sm font-semibold tabular-nums text-white">
          {formatUsd(position.currentValue)}
        </div>
        <div className={cn("text-right text-sm font-semibold tabular-nums", pnlColorClass(position.totalPnl))}>
          {formatSignedUsd(position.totalPnl)}
          <div className="text-[11px] font-medium">{formatPercent(position.totalPnlRatio)}</div>
        </div>
        <div className={cn("text-right text-sm tabular-nums", pnlColorClass(position.realizedPnl))}>
          {formatSignedUsd(position.realizedPnl)}
        </div>
        <div className={cn("text-right text-sm tabular-nums", pnlColorClass(position.unrealizedPnl))}>
          {formatSignedUsd(position.unrealizedPnl)}
        </div>
        <LiveRelativeTime
          ts={position.lastActivityTs}
          className="text-right text-xs tabular-nums text-zinc-400"
        />
        <div className="text-right">
          <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", statusMeta.cls)}>
            {statusMeta.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity tab
// ---------------------------------------------------------------------------

function ActivityList({
  wallet,
  query,
  interval,
  tag,
  scrollRef,
}: {
  wallet: string;
  query: string;
  interval: LeaderboardInterval;
  tag?: string | null;
  scrollRef: RefObject<HTMLDivElement>;
}) {
  const { t } = useTranslation();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useWalletActivities(wallet, interval, tag);

  const q = query.trim().toLowerCase();
  const activities = (data?.pages.flatMap((p) => p.activities) ?? []).filter(
    (a) => !q || transText(a.marketQuestionTrans, a.marketQuestion).toLowerCase().includes(q),
  );

  const count = activities.length + (hasNextPage ? 1 : 0);
  const { wrapRef, virtualizer, scrollMargin } = useWindowList(scrollRef, count, [
    activities.length,
    hasNextPage,
  ]);
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= activities.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualItems, activities.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <ActivityRowsSkeleton />;
  if (activities.length === 0) {
    return <EmptyBlock message={t("extend.leaderboard.noActivity")} />;
  }

  return (
    <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/20">
      <div ref={wrapRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((vItem) => {
          const isLoaderRow = vItem.index >= activities.length;
          const a = activities[vItem.index];
          return (
            <div
              key={isLoaderRow ? "loader" : a.activityId ?? `${a.activityTs}-${vItem.index}`}
              ref={virtualizer.measureElement}
              data-index={vItem.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${vItem.start - scrollMargin}px)` }}
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

type ActivityTypeLabelKey =
  | "extend.leaderboard.activity.buy"
  | "extend.leaderboard.activity.sell"
  | "extend.leaderboard.activity.redeem";

function activityTypeMeta(type: string): { key: ActivityTypeLabelKey; className: string } {
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
  const marketQuestion = transText(activity.marketQuestionTrans, activity.marketQuestion);
  const outcome = transText(activity.outcomeTrans, activity.outcome);

  return (
    <div className={cn("flex items-center gap-3 px-3 py-3", !last && "border-b border-zinc-800/40")}>
      <MarketAvatar
        src={activity.marketImageUrl || activity.eventImageUrl}
        seed={activity.conditionId || activity.tokenId || activity.eventSlug}
        size={34}
      />
      <div className="min-w-0 flex-1">
        <EventTitleLink
          slug={activity.eventSlug}
          className="line-clamp-1 text-sm font-medium text-zinc-100"
        >
          {marketQuestion || outcome || "—"}
        </EventTitleLink>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
          <span className={cn("rounded px-1.5 py-0.5 font-medium", meta.className)}>
            {t(meta.key)}
          </span>
          {outcome && <span className="text-zinc-400">{outcome}</span>}
          <span className="tabular-nums">
            {formatPrice(activity.price)} ·{" "}
            {activity.quantity.toLocaleString("en-US", { maximumFractionDigits: 2 })}
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

/**
 * Activity list placeholder shown while the activity tab loads. Mirrors the
 * real {@link ActivityRow}: a market thumbnail, a two-line market/meta block
 * and a right-aligned amount.
 */
function ActivityRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/20">
      <div className="divide-y divide-zinc-800/40">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <div className="size-[34px] shrink-0 animate-pulse rounded-md bg-zinc-800/50" />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 h-3.5 w-2/3 animate-pulse rounded bg-zinc-800/50" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-zinc-800/50" />
            </div>
            <div className="h-4 w-16 shrink-0 animate-pulse rounded bg-zinc-800/50" />
          </div>
        ))}
      </div>
    </div>
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
