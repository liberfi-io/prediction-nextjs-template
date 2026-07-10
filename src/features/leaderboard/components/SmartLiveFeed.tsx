"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTickAge } from "@liberfi.io/hooks";
import { useTranslation } from "@liberfi.io/i18n";
import { cn, PauseIcon, VirtualList, type VirtualRowComponentProps } from "@liberfi.io/ui";
import { CopyButton } from "../../../components/CopyButton";
import { GradientAvatar } from "../../../components/GradientAvatar";
import type { WorldCupTranslate } from "../../worldcup/display";
import {
  formatAgeMs,
  formatPrice,
  formatUsd,
  parseTimestampMs,
  shortAddress,
} from "../format";
import { useSmartMoneyLiveFeed } from "../data/queries";
import { subscribeSmartMoneyLiveFeed } from "../data/liveFeedSubscription";
import { liveActivityKey } from "../data/liveFeedAdapter";
import { buildLeaderboardSearch, type LeaderboardScope } from "../routeParams";
import type { SmartMoneyLiveActivity, SmartMoneyLiveActivityType } from "../types";
import { ActivityTypeBadge } from "./ActivityTypeBadge";
import { EventTitleLink } from "./SummaryCards";
import {
  leaderboardDisplay,
  transText,
  useWorldcupMatchBySlug,
  worldcupMatchSlugForLeaderboardItem,
  type WorldcupMatchBySlug,
} from "./activityDisplay";

type LiveFeedTypeFilter = SmartMoneyLiveActivityType | "all";
type LiveFeedSort =
  | "time_desc"
  | "amount_desc"
  | "amount_asc"
  | "price_desc"
  | "price_asc"
  | "shares_desc"
  | "shares_asc";

interface LiveFeedFilters {
  type: LiveFeedTypeFilter;
  categories: string[];
  walletTypes: string[];
  amountMin: string;
  amountMax: string;
  sharesMin: string;
  sharesMax: string;
  priceMin: string;
  priceMax: string;
  sort: LiveFeedSort;
}

const TYPE_FILTERS: LiveFeedTypeFilter[] = ["all", "buy", "sell", "redeem"];
const MAX_LIVE_ROWS = 100;
const LIVE_FEED_BATCH_MS = 250;
const DESKTOP_ROW_ESTIMATE = 64;
const DESKTOP_GRID =
  "grid grid-cols-[90px_88px_minmax(120px,1fr)_minmax(260px,2.3fr)_110px_100px_88px] items-center gap-3";

const INITIAL_FILTERS: LiveFeedFilters = {
  type: "all",
  categories: [],
  walletTypes: [],
  amountMin: "",
  amountMax: "",
  sharesMin: "",
  sharesMax: "",
  priceMin: "",
  priceMax: "",
  sort: "time_desc",
};

function rowTime(row: SmartMoneyLiveActivity): number {
  return row.timestamp ?? 0;
}

function rowAmount(row: SmartMoneyLiveActivity): number {
  return row.amountInUsd || row.amount;
}

function inRange(value: number, minText: string, maxText: string): boolean {
  const min = minText === "" ? undefined : Number(minText);
  const max = maxText === "" ? undefined : Number(maxText);
  if (min !== undefined && Number.isFinite(min) && value < min) return false;
  if (max !== undefined && Number.isFinite(max) && value > max) return false;
  return true;
}

function mergeRows(
  liveRows: SmartMoneyLiveActivity[],
  snapshotRows: SmartMoneyLiveActivity[],
): SmartMoneyLiveActivity[] {
  const seen = new Set<string>();
  const merged: SmartMoneyLiveActivity[] = [];
  for (const row of [...liveRows, ...snapshotRows]) {
    const key = liveActivityKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged.sort((a, b) => rowTime(b) - rowTime(a));
}

function filterAndSortLiveActivities(
  rows: SmartMoneyLiveActivity[],
  filters: LiveFeedFilters,
): SmartMoneyLiveActivity[] {
  const filtered = rows.filter((row) => {
    if (filters.type !== "all" && row.type !== filters.type) return false;
    if (filters.categories.length > 0 && !row.tags.some((tag) => filters.categories.includes(tag))) {
      return false;
    }
    if (
      filters.walletTypes.length > 0 &&
      !row.traderTags.some((tag) => filters.walletTypes.includes(tag))
    ) {
      return false;
    }
    if (!inRange(rowAmount(row), filters.amountMin, filters.amountMax)) return false;
    if (!inRange(row.quantity, filters.sharesMin, filters.sharesMax)) return false;
    if (!inRange(row.price * 100, filters.priceMin, filters.priceMax)) return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case "amount_desc":
        return rowAmount(b) - rowAmount(a);
      case "amount_asc":
        return rowAmount(a) - rowAmount(b);
      case "price_desc":
        return b.price - a.price;
      case "price_asc":
        return a.price - b.price;
      case "shares_desc":
        return b.quantity - a.quantity;
      case "shares_asc":
        return a.quantity - b.quantity;
      default:
        return rowTime(b) - rowTime(a);
    }
  });
}

export function SmartLiveFeed({
  tag,
  scope,
}: {
  tag?: string | null;
  scope: LeaderboardScope;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, isLoading, isError } = useSmartMoneyLiveFeed(tag);
  const [liveRows, setLiveRows] = useState<SmartMoneyLiveActivity[]>([]);
  const [updatesPaused, setUpdatesPaused] = useState(false);
  const [filters, setFilters] = useState<LiveFeedFilters>(INITIAL_FILTERS);
  const pendingRowsRef = useRef<SmartMoneyLiveActivity[]>([]);
  const flushTimerRef = useRef<number>();
  const updatesPausedRef = useRef(false);

  const flushPendingRows = useCallback(() => {
    flushTimerRef.current = undefined;
    const pending = pendingRowsRef.current;
    pendingRowsRef.current = [];
    if (pending.length === 0) return;
    setLiveRows((current) => mergeRows([...pending, ...current], []).slice(0, MAX_LIVE_ROWS));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (updatesPausedRef.current || flushTimerRef.current) return;
    flushTimerRef.current = window.setTimeout(flushPendingRows, LIVE_FEED_BATCH_MS);
  }, [flushPendingRows]);

  useEffect(() => {
    setLiveRows([]);
    setUpdatesPaused(false);
    updatesPausedRef.current = false;
    pendingRowsRef.current = [];
    if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);

    const unsubscribe = subscribeSmartMoneyLiveFeed({
      tag,
      onActivity: (activity) => {
        pendingRowsRef.current.unshift(activity);
        scheduleFlush();
      },
    });
    return () => {
      unsubscribe();
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      pendingRowsRef.current = [];
    };
  }, [flushPendingRows, scheduleFlush, tag]);

  const rows = useMemo(
    () => mergeRows(liveRows, data?.activities ?? []),
    [data?.activities, liveRows],
  );
  const worldcupMatchBySlug = useWorldcupMatchBySlug(rows);
  const visibleRows = useMemo(
    () => filterAndSortLiveActivities(rows, filters),
    [filters, rows],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => row.tags))).sort(),
    [rows],
  );
  const walletTypeOptions = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => row.traderTags))).sort(),
    [rows],
  );

  useEffect(() => {
    setFilters((current) => {
      const categories = current.categories.filter((value) => categoryOptions.includes(value));
      const walletTypes = current.walletTypes.filter((value) => walletTypeOptions.includes(value));
      if (
        categories.length === current.categories.length &&
        walletTypes.length === current.walletTypes.length
      ) {
        return current;
      }
      return { ...current, categories, walletTypes };
    });
  }, [categoryOptions, walletTypeOptions]);

  const sortOptions = useMemo(
    () => [
      {
        value: "time_desc",
        label: t("extend.leaderboard.liveFeed.sortTimeDesc", { defaultValue: "Newest" }),
      },
      {
        value: "amount_desc",
        label: t("extend.leaderboard.liveFeed.sortAmountDesc", { defaultValue: "Amount high to low" }),
      },
      {
        value: "amount_asc",
        label: t("extend.leaderboard.liveFeed.sortAmountAsc", { defaultValue: "Amount low to high" }),
      },
      {
        value: "price_desc",
        label: t("extend.leaderboard.liveFeed.sortPriceDesc", { defaultValue: "Price high to low" }),
      },
      {
        value: "price_asc",
        label: t("extend.leaderboard.liveFeed.sortPriceAsc", { defaultValue: "Price low to high" }),
      },
      {
        value: "shares_desc",
        label: t("extend.leaderboard.liveFeed.sortSharesDesc", { defaultValue: "Shares high to low" }),
      },
      {
        value: "shares_asc",
        label: t("extend.leaderboard.liveFeed.sortSharesAsc", { defaultValue: "Shares low to high" }),
      },
    ],
    [t],
  );

  const setFilter = <K extends keyof LiveFeedFilters>(key: K, value: LiveFeedFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleTrader = (wallet: string) => {
    if (!wallet) return;
    router.push(`/leaderboard/${encodeURIComponent(wallet)}${buildLeaderboardSearch({ scope })}`, {
      scroll: false,
    });
  };

  const pauseUpdates = useCallback(() => {
    updatesPausedRef.current = true;
    setUpdatesPaused(true);
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = undefined;
    }
  }, []);

  const resumeUpdates = useCallback(() => {
    updatesPausedRef.current = false;
    setUpdatesPaused(false);
    flushPendingRows();
  }, [flushPendingRows]);

  const renderTypeAndSortControls = () => (
    <>
      {TYPE_FILTERS.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => setFilter("type", type)}
          className={cn(
            "shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
            filters.type === type
              ? "border-bullish/30 bg-bullish/10 text-bullish"
              : "border-zinc-800/80 text-zinc-500 hover:text-zinc-300",
          )}
        >
          {type === "all"
            ? t("extend.leaderboard.liveFeed.all", { defaultValue: "All" })
            : String(t(`extend.leaderboard.activity.${type}`))}
        </button>
      ))}
      <LiveFeedSelect
        label={t("extend.leaderboard.liveFeed.sortTimeDesc", { defaultValue: "Newest" })}
        options={sortOptions}
        value={filters.sort}
        onChange={(value) => setFilter("sort", value as LiveFeedSort)}
        allowEmpty={false}
      />
    </>
  );

  const renderRangeControls = (compact = false) => (
    <>
      <RangeInput
        label={t("extend.leaderboard.liveFeed.amount", { defaultValue: "Amount" })}
        min={filters.amountMin}
        max={filters.amountMax}
        onMin={(value) => setFilter("amountMin", value)}
        onMax={(value) => setFilter("amountMax", value)}
        compact={compact}
      />
      <RangeInput
        label={t("extend.leaderboard.liveFeed.shares", { defaultValue: "Shares" })}
        min={filters.sharesMin}
        max={filters.sharesMax}
        onMin={(value) => setFilter("sharesMin", value)}
        onMax={(value) => setFilter("sharesMax", value)}
        compact={compact}
      />
      <RangeInput
        label={t("extend.leaderboard.liveFeed.price", { defaultValue: "Price" })}
        min={filters.priceMin}
        max={filters.priceMax}
        onMin={(value) => setFilter("priceMin", value)}
        onMax={(value) => setFilter("priceMax", value)}
        compact={compact}
      />
      {updatesPaused && <PausedUpdatesIndicator />}
      {categoryOptions.length > 0 && (
        <LiveFeedSelect
          label={t("extend.leaderboard.liveFeed.category", { defaultValue: "Category" })}
          options={categoryOptions.map((option) => ({ value: option, label: option }))}
          value={filters.categories[0] ?? ""}
          onChange={(value) => setFilter("categories", value ? [value] : [])}
        />
      )}
      {walletTypeOptions.length > 0 && (
        <LiveFeedSelect
          label={t("extend.leaderboard.liveFeed.walletType", { defaultValue: "Wallet Type" })}
          options={walletTypeOptions.map((option) => ({ value: option, label: option }))}
          value={filters.walletTypes[0] ?? ""}
          onChange={(value) => setFilter("walletTypes", value ? [value] : [])}
        />
      )}
    </>
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col pb-4">
      <div className="flex shrink-0 flex-col gap-2 border-b border-zinc-800/60 py-3">
        <div className="hidden items-center gap-2 overflow-x-auto overflow-y-hidden pb-1 lg:flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {renderTypeAndSortControls()}
          {renderRangeControls()}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {renderTypeAndSortControls()}
        </div>
        <div className="flex flex-col gap-2 overflow-y-hidden pb-1 sm:flex-row sm:items-center sm:overflow-x-auto lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {renderRangeControls(true)}
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          className="custom-scrollbar h-full w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain [touch-action:pan-x_pan-y]"
          onMouseEnter={pauseUpdates}
          onMouseLeave={resumeUpdates}
        >
          <div className="flex h-full w-[980px] max-w-none flex-col lg:w-full">
            <div className={cn(DESKTOP_GRID, "shrink-0 border-b border-zinc-800/50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500")}>
              <div>{t("extend.leaderboard.liveFeed.time", { defaultValue: "Time" })}</div>
              <div>{t("extend.leaderboard.liveFeed.type", { defaultValue: "Type" })}</div>
              <div>{t("extend.leaderboard.liveFeed.trader", { defaultValue: "Trader" })}</div>
              <div>{t("extend.leaderboard.liveFeed.market", { defaultValue: "Market" })}</div>
              <div className="text-right">
                {t("extend.leaderboard.liveFeed.amount", { defaultValue: "Amount" })}
              </div>
              <div className="text-right">
                {t("extend.leaderboard.liveFeed.shares", { defaultValue: "Shares" })}
              </div>
              <div className="text-right">
                {t("extend.leaderboard.liveFeed.price", { defaultValue: "Price" })}
              </div>
            </div>
            <LiveFeedBody
              rows={visibleRows}
              worldcupMatchBySlug={worldcupMatchBySlug}
              isLoading={isLoading}
              isError={isError}
              onTrader={handleTrader}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PausedUpdatesIndicator() {
  return (
    <div className="flex h-8 w-7 shrink-0 items-center justify-center text-bullish">
      <PauseIcon width={22} height={22} aria-hidden />
    </div>
  );
}

function RangeInput({
  label,
  min,
  max,
  onMin,
  onMax,
  compact = false,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-lg border border-zinc-800/80 px-2 py-1",
        compact
          ? "grid w-full grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:flex sm:w-auto"
          : "flex items-center gap-1",
      )}
    >
      <span className="shrink-0 text-xs font-medium text-zinc-500">{label}</span>
      <input
        value={min}
        onChange={(event) => onMin(event.target.value)}
        inputMode="decimal"
        placeholder="min"
        className={cn(
          "h-6 bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-700",
          compact ? "min-w-0 sm:w-14 sm:flex-none" : "w-14",
        )}
      />
      <span className="text-zinc-700">-</span>
      <input
        value={max}
        onChange={(event) => onMax(event.target.value)}
        inputMode="decimal"
        placeholder="max"
        className={cn(
          "h-6 bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-700",
          compact ? "min-w-0 sm:w-14 sm:flex-none" : "w-14",
        )}
      />
    </div>
  );
}

function LiveFeedSelect({
  label,
  options,
  value,
  onChange,
  allowEmpty = true,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value);

  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 224;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    setMenuStyle({
      left,
      position: "fixed",
      top: rect.bottom + 8,
      width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  return (
    <div
      className="relative shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "flex shrink-0 cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-xs font-semibold outline-none transition-colors",
          open
            ? "border-bullish/30 bg-bullish/10 text-bullish"
            : "border-zinc-800/80 text-zinc-500 hover:text-zinc-300",
        )}
        onClick={() => {
          updateMenuPosition();
          setOpen((current) => !current);
        }}
      >
        <span className="min-w-0 truncate">{selected?.label ?? label}</span>
        <svg
          viewBox="0 0 24 24"
          width={14}
          height={14}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("shrink-0 text-zinc-500 transition-transform", open && "rotate-180")}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          className="z-50 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40"
          style={menuStyle}
        >
          <div className="max-h-72 overflow-y-auto p-1">
            {allowEmpty && (
              <button
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-center rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  value === "" ? "bg-bullish/10 text-bullish" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100",
                )}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                {label}
              </button>
            )}
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-center rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  option.value === value
                    ? "bg-bullish/10 text-bullish"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100",
                )}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveFeedBody({
  rows,
  worldcupMatchBySlug,
  isLoading,
  isError,
  onTrader,
}: {
  rows: SmartMoneyLiveActivity[];
  worldcupMatchBySlug: WorldcupMatchBySlug;
  isLoading: boolean;
  isError: boolean;
  onTrader: (wallet: string) => void;
}) {
  const { t } = useTranslation();

  if (isLoading) return <EmptyState label={t("extend.leaderboard.loading")} />;
  if (isError) return <EmptyState label={t("extend.leaderboard.loadError")} />;
  if (rows.length === 0) {
    return <EmptyState label={t("extend.leaderboard.liveFeed.empty", { defaultValue: "No live activity yet" })} />;
  }
  return (
    <VirtualList
      className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain"
      style={{ height: "100%" }}
      rowComponent={DesktopVirtualRow}
      rowCount={rows.length}
      rowHeight={DESKTOP_ROW_ESTIMATE}
      rowProps={{ rows, worldcupMatchBySlug, onTrader }}
      overscanCount={10}
    />
  );
}

type LiveFeedRowData = {
  rows: SmartMoneyLiveActivity[];
  worldcupMatchBySlug: WorldcupMatchBySlug;
  onTrader: (wallet: string) => void;
};

function DesktopVirtualRow({
  index,
  style,
  ariaAttributes,
  rows,
  worldcupMatchBySlug,
  onTrader,
}: VirtualRowComponentProps<LiveFeedRowData>) {
  const row = rows[index];
  if (!row) return null;

  return (
    <div style={style} data-index={index} {...ariaAttributes}>
      <DesktopRow row={row} worldcupMatchBySlug={worldcupMatchBySlug} onTrader={onTrader} />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[360px] items-center justify-center text-sm font-medium text-zinc-500">
      {label}
    </div>
  );
}

function marketTitle(row: SmartMoneyLiveActivity): string {
  return (
    transText(row.market?.questionTrans, row.market?.question) ||
    transText(row.marketQuestionTrans, row.marketQuestion) ||
    transText(row.event?.titleTrans, row.event?.title) ||
    transText(row.eventTitleTrans, row.eventTitle) ||
    "—"
  );
}

function outcomeLabel(row: SmartMoneyLiveActivity): string {
  return (
    transText(row.outcomeTrans, row.outcome) ||
    transText(row.market?.outcomes?.[0]?.labelTrans, row.market?.outcomes?.[0]?.label) ||
    "—"
  );
}

function outcomeTone(row: SmartMoneyLiveActivity): "bullish" | "bearish" | "neutral" {
  const raw = String(row.outcome || row.market?.outcomes?.[0]?.label || "").trim().toLowerCase();
  if (!raw) return "neutral";
  if (["yes", "up", "over", "above", "higher", "long"].includes(raw)) return "bullish";
  if (["no", "down", "under", "below", "lower", "short"].includes(raw)) return "bearish";
  return "neutral";
}

function OutcomeBadge({
  row,
  label = outcomeLabel(row),
}: {
  row: SmartMoneyLiveActivity;
  label?: string;
}) {
  const tone = outcomeTone(row);
  return (
    <span
      className={cn(
        "inline-flex max-w-[120px] shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        tone === "bullish"
          ? "bg-bullish/10 text-bullish"
          : tone === "bearish"
            ? "bg-bearish/10 text-bearish"
            : "bg-zinc-800/70 text-zinc-300",
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

function traderLabel(row: SmartMoneyLiveActivity): string {
  return row.traderName || shortAddress(row.wallet) || "—";
}

function eventSlug(row: SmartMoneyLiveActivity): string | undefined {
  return row.eventSlug || row.market?.eventSlug || row.event?.slug;
}

function liveFeedWorldcupMatchSlug(row: SmartMoneyLiveActivity): string | null {
  const slug = worldcupMatchSlugForLeaderboardItem(row);
  return slug;
}

function LiveActivityAge({ ts }: { ts: string | number | null | undefined }) {
  const timestampMs = parseTimestampMs(ts);
  const ageMs = useTickAge(timestampMs ?? Date.now());
  return <>{timestampMs == null ? "—" : formatAgeMs(ageMs)}</>;
}

function MarketAvatar({
  src,
  seed,
  size = 28,
}: {
  src?: string;
  seed?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-lg bg-zinc-800 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return <GradientAvatar seed={seed} size={size} />;
}

function MarketOutcomeCell({
  row,
  worldcupMatchBySlug,
}: {
  row: SmartMoneyLiveActivity;
  worldcupMatchBySlug: WorldcupMatchBySlug;
}) {
  const { t } = useTranslation();
  const matchSlug = liveFeedWorldcupMatchSlug(row);
  const isWorldcup = Boolean(matchSlug && worldcupMatchBySlug.has(matchSlug));

  if (isWorldcup) {
    const display = leaderboardDisplay(row, worldcupMatchBySlug, t as WorldCupTranslate);
    const outcome = display.outcomeLabel || outcomeLabel(row);
    return (
      <div className="flex min-w-0 items-center gap-2">
        <MarketAvatar
          src={display.imageUrl}
          seed={row.conditionId || row.tokenId || row.eventSlug}
          size={30}
        />
        <div className="min-w-0">
          <EventTitleLink slug={eventSlug(row)} className="line-clamp-1 text-sm font-medium text-zinc-100">
            {display.title || "—"}
          </EventTitleLink>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            {display.subtitle && (
              <span className="min-w-0 truncate text-[11px] uppercase tracking-wide text-zinc-600">
                {display.subtitle}
              </span>
            )}
            <OutcomeBadge row={row} label={outcome} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <MarketAvatar
        src={marketImage(row)}
        seed={row.conditionId || row.tokenId || row.eventSlug || row.wallet}
        size={30}
      />
      <div className="min-w-0">
        <EventTitleLink slug={eventSlug(row)} className="line-clamp-1 text-sm font-medium text-zinc-100">
          {marketTitle(row)}
        </EventTitleLink>
        <div className="mt-0.5">
          <OutcomeBadge row={row} />
        </div>
      </div>
    </div>
  );
}

function marketImage(row: SmartMoneyLiveActivity): string | undefined {
  return row.market?.imageUrl || row.marketImageUrl || row.event?.imageUrl || row.eventImageUrl;
}

function DesktopRow({
  row,
  worldcupMatchBySlug,
  onTrader,
}: {
  row: SmartMoneyLiveActivity;
  worldcupMatchBySlug: WorldcupMatchBySlug;
  onTrader: (wallet: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn(DESKTOP_GRID, "min-h-[64px] border-b border-zinc-800/40 px-3 py-3 text-sm hover:bg-zinc-800/20")}>
      <div className="text-xs text-zinc-500">
        <LiveActivityAge ts={row.timestamp} />
      </div>
      <div>
        <ActivityTypeBadge type={row.type} />
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onTrader(row.wallet)}
          disabled={!row.wallet}
          className="min-w-0 cursor-pointer truncate text-left text-zinc-300 transition-colors hover:text-zinc-100 hover:underline disabled:cursor-default disabled:text-zinc-600 disabled:no-underline"
        >
          {traderLabel(row)}
        </button>
        {row.wallet && (
          <CopyButton
            value={row.wallet}
            title={t("extend.leaderboard.copy")}
            copiedMessage={t("extend.leaderboard.copiedAddress", { defaultValue: "Address copied" })}
            size={12}
            className="shrink-0 p-0.5 hover:bg-transparent"
          />
        )}
      </div>
      <MarketOutcomeCell row={row} worldcupMatchBySlug={worldcupMatchBySlug} />
      <div className="text-right font-semibold tabular-nums text-zinc-100">
        {formatUsd(rowAmount(row))}
      </div>
      <div className="text-right tabular-nums text-zinc-300">
        {row.quantity.toLocaleString("en-US", { maximumFractionDigits: 2 })}
      </div>
      <div className="text-right tabular-nums text-zinc-300">{formatPrice(row.price)}</div>
    </div>
  );
}
