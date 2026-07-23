"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { useTranslation } from "@liberfi.io/i18n";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  cn,
  HorizontalScrollContainer,
} from "@liberfi.io/ui";
import type {
  SportsMatchCard,
  SportsSection,
  SportsTaxonomyNode,
} from "../types";
import {
  sportsLiveHref,
  taxonomyHref,
} from "../route/sportsTaxonomyNav";
import {
  sportsLiveTimeRange,
  type SportsLiveTimeRange,
} from "../live/sportsLiveTimeRange";
import { isPlainSameWindowNavigation } from "../route/isPlainSameWindowNavigation";
import { LocalizedTaxonomyLabel } from "../i18n/LocalizedTaxonomyLabel";

const SPORTS_LIVE_DATE_COUNT = 7;
const TAXONOMY_SCROLL_EDGE_INSET = 32;

export interface SportsLiveTaxonomyItem {
  node: SportsTaxonomyNode;
  active: boolean;
  count?: number;
}

interface OptimisticLiveDateState {
  sourceSelectedDateKey: string;
  sourceRangeStart: string;
  selectedDateKey: string;
  rangeStart: string;
}

interface OptimisticTaxonomyState {
  sourceKey: string;
  selectedKey: string;
}

function startOfLocalDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function utcDateKey(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function keepSelectedTaxonomyVisible(navigation: HTMLElement): void {
  const selectedLink =
    navigation.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
  const scrollContainer = selectedLink?.parentElement;
  if (!selectedLink || !scrollContainer) return;

  const containerRect = scrollContainer.getBoundingClientRect();
  const selectedRect = selectedLink.getBoundingClientRect();
  const leftDelta =
    selectedRect.left < containerRect.left + TAXONOMY_SCROLL_EDGE_INSET
      ? selectedRect.left -
        containerRect.left -
        TAXONOMY_SCROLL_EDGE_INSET
      : selectedRect.right >
          containerRect.right - TAXONOMY_SCROLL_EDGE_INSET
        ? selectedRect.right -
          containerRect.right +
          TAXONOMY_SCROLL_EDGE_INSET
        : 0;
  if (leftDelta === 0) return;

  scrollContainer.scrollBy?.({
    left: leftDelta,
    behavior: "auto",
  });
}

function usePostPaintAction(): (action: () => void) => void {
  const pendingFramesRef = useRef(new Set<number>());

  useEffect(
    () => () => {
      for (const frame of pendingFramesRef.current) {
        window.cancelAnimationFrame(frame);
      }
      pendingFramesRef.current.clear();
    },
    [],
  );

  return useCallback((action: () => void) => {
    const firstFrame = window.requestAnimationFrame(() => {
      pendingFramesRef.current.delete(firstFrame);
      const secondFrame = window.requestAnimationFrame(() => {
        pendingFramesRef.current.delete(secondFrame);
        action();
      });
      pendingFramesRef.current.add(secondFrame);
    });
    pendingFramesRef.current.add(firstFrame);
  }, []);
}

/** Returns the seven UTC calendar dates shown by the live list. */
export function sportsLiveDates(start: Date): Date[] {
  const firstDate = startOfUtcDay(start);
  return Array.from({ length: SPORTS_LIVE_DATE_COUNT }, (_, index) => {
    const date = new Date(firstDate);
    date.setUTCDate(date.getUTCDate() + index);
    return date;
  });
}

/** Formats the date range carried by the live-list title. */
export function formatSportsLiveDateRange(dates: Date[], lang: string): string {
  const start = dates[0];
  const end = dates[dates.length - 1];
  if (!start || !end) return "";
  const crossesYear = start.getUTCFullYear() !== end.getUTCFullYear();
  const formatter = new Intl.DateTimeFormat(lang, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...(crossesYear ? { year: "numeric" } : {}),
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function matchesInRange(
  matches: SportsMatchCard[],
  start: Date,
  end: Date,
): SportsMatchCard[] {
  return matches.filter((match) => {
    const timestamp = Date.parse(match.start_time ?? "");
    return timestamp >= start.getTime() && timestamp < end.getTime();
  });
}

/** Returns matches whose start time falls on the selected local date. */
export function matchesForDate(
  matches: SportsMatchCard[],
  date: Date,
): SportsMatchCard[] {
  const start = startOfLocalDay(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return matchesInRange(matches, start, end);
}

/** Returns matches whose start time falls on the selected UTC date. */
export function matchesForUtcDate(
  matches: SportsMatchCard[],
  date: Date,
): SportsMatchCard[] {
  const start = startOfUtcDay(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return matchesInRange(matches, start, end);
}

/** Renders live-list date controls and first-level taxonomy switches. */
export function SportsLiveFilters({
  section,
  taxonomyItems,
  dates,
  selectedDate,
  timeRange,
  liveRangeStart,
  trailingControl,
  lang,
  onDateChange,
  onToday,
  previousWeekDisabled,
  onPreviousWeek,
  onNextWeek,
  onTaxonomyNavigate,
  onAllNavigate,
}: {
  section: SportsSection;
  taxonomyItems: SportsLiveTaxonomyItem[];
  dates: Date[];
  selectedDate: Date;
  timeRange: SportsLiveTimeRange;
  liveRangeStart: string;
  trailingControl?: ReactNode;
  lang: string;
  onDateChange: (date: Date) => void;
  onToday: () => void;
  previousWeekDisabled: boolean;
  onPreviousWeek: (date: Date) => void;
  onNextWeek: (date: Date) => void;
  onTaxonomyNavigate: (
    node: SportsTaxonomyNode,
    date: Date,
    rangeStart: Date,
  ) => void;
  onAllNavigate: (date: Date, rangeStart: Date) => void;
}) {
  const { t } = useTranslation();
  const routeSelectedDateKey = utcDateKey(selectedDate);
  const [optimisticDateState, setOptimisticDateState] =
    useState<OptimisticLiveDateState>();
  const optimisticDateApplies =
    optimisticDateState?.sourceSelectedDateKey === routeSelectedDateKey &&
    optimisticDateState.sourceRangeStart === liveRangeStart;
  const selectedDateKey = optimisticDateApplies
    ? optimisticDateState.selectedDateKey
    : routeSelectedDateKey;
  const selectedLiveRangeStart = optimisticDateApplies
    ? optimisticDateState.rangeStart
    : liveRangeStart;
  const selectedTimeRange = optimisticDateApplies
    ? sportsLiveTimeRange(new Date(`${selectedDateKey}T00:00:00Z`))
    : timeRange;
  const visibleDates =
    selectedLiveRangeStart === liveRangeStart
      ? dates
      : sportsLiveDates(new Date(selectedLiveRangeStart));
  const visibleTaxonomyItems = taxonomyItems.filter(
    (item) => typeof item.count === "number" && item.count > 0,
  );
  const taxonomyNavRef = useRef<HTMLElement>(null);
  const routeHasActiveTaxonomy = taxonomyItems.some((item) => item.active);
  const routeActiveTaxonomyNode = visibleTaxonomyItems.find(
    (item) => item.active,
  )?.node;
  const routeActiveTaxonomyKey = routeActiveTaxonomyNode
    ? `${routeActiveTaxonomyNode.node_type}:${routeActiveTaxonomyNode.slug}`
    : !routeHasActiveTaxonomy
      ? "all"
      : undefined;
  const routeTaxonomyStateKey = routeActiveTaxonomyKey ?? "hidden";
  const [optimisticTaxonomyState, setOptimisticTaxonomyState] =
    useState<OptimisticTaxonomyState>();
  const activeTaxonomyKey =
    optimisticTaxonomyState?.sourceKey === routeTaxonomyStateKey
      ? optimisticTaxonomyState.selectedKey
      : routeActiveTaxonomyKey;
  const hasActiveTaxonomy =
    activeTaxonomyKey !== "all" &&
    (Boolean(activeTaxonomyKey) || routeHasActiveTaxonomy);
  const schedulePostPaintAction = usePostPaintAction();
  const visibleTaxonomyKey = visibleTaxonomyItems
    .map(({ node, count }) => `${node.node_type}:${node.slug}:${count}`)
    .join("|");
  const fullDateFormatter = new Intl.DateTimeFormat(lang, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const weekdayFormatter = new Intl.DateTimeFormat(lang, {
    weekday: "short",
    timeZone: "UTC",
  });

  useEffect(() => {
    if (taxonomyNavRef.current) {
      keepSelectedTaxonomyVisible(taxonomyNavRef.current);
    }
  }, [activeTaxonomyKey, visibleTaxonomyKey]);

  const updateOptimisticDate = (date: Date, rangeStart: string) => {
    setOptimisticDateState({
      sourceSelectedDateKey: routeSelectedDateKey,
      sourceRangeStart: liveRangeStart,
      selectedDateKey: utcDateKey(date),
      rangeStart,
    });
    setOptimisticTaxonomyState({
      sourceKey: routeTaxonomyStateKey,
      selectedKey: "all",
    });
  };
  const selectDate = (date: Date) => {
    updateOptimisticDate(date, selectedLiveRangeStart);
    schedulePostPaintAction(() => onDateChange(date));
  };
  const selectToday = () => {
    const today = new Date();
    updateOptimisticDate(
      today,
      sportsLiveTimeRange(today).start_time_gte,
    );
    schedulePostPaintAction(onToday);
  };
  const selectWeek = (direction: "previous" | "next") => {
    const nextDate = new Date(visibleDates[0] ?? selectedDate);
    nextDate.setUTCDate(
      nextDate.getUTCDate() + (direction === "previous" ? -7 : 7),
    );
    updateOptimisticDate(
      nextDate,
      sportsLiveTimeRange(nextDate).start_time_gte,
    );
    schedulePostPaintAction(() =>
      direction === "previous"
        ? onPreviousWeek(nextDate)
        : onNextWeek(nextDate),
    );
  };
  const selectTaxonomy = (
    event: MouseEvent<HTMLAnchorElement>,
    node: SportsTaxonomyNode,
  ) => {
    if (!isPlainSameWindowNavigation(event)) return;
    event.preventDefault();
    const nextKey = `${node.node_type}:${node.slug}`;
    if (nextKey === activeTaxonomyKey) return;
    setOptimisticTaxonomyState({
      sourceKey: routeTaxonomyStateKey,
      selectedKey: nextKey,
    });
    schedulePostPaintAction(() =>
      onTaxonomyNavigate(
        node,
        new Date(`${selectedDateKey}T00:00:00Z`),
        new Date(selectedLiveRangeStart),
      ),
    );
  };
  const selectAllTaxonomies = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainSameWindowNavigation(event)) return;
    event.preventDefault();
    if (activeTaxonomyKey === "all") return;
    setOptimisticTaxonomyState({
      sourceKey: routeTaxonomyStateKey,
      selectedKey: "all",
    });
    schedulePostPaintAction(() =>
      onAllNavigate(
        new Date(`${selectedDateKey}T00:00:00Z`),
        new Date(selectedLiveRangeStart),
      ),
    );
  };

  return (
    <div className="space-y-3 pb-4">
      <div
        data-testid="sports-live-date-picker"
        className="flex w-full max-w-[520px] items-stretch gap-0.5 overflow-hidden sm:max-w-[560px] sm:gap-1"
      >
        <button
          type="button"
          className="flex h-10 shrink-0 cursor-pointer items-center rounded-md px-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-900/60 hover:text-zinc-200 sm:h-12 sm:px-2 sm:text-sm"
          onClick={selectToday}
        >
          {t("extend.worldcup.tab.today")}
        </button>
        <button
          type="button"
          aria-label={t("extend.sports.filters.previousWeek")}
          className="flex h-10 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-900/60 hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700 disabled:hover:bg-transparent disabled:hover:text-zinc-700 sm:h-12 sm:w-8"
          disabled={previousWeekDisabled}
          onClick={() => selectWeek("previous")}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <div
          data-testid="sports-live-date-grid"
          className="grid min-w-0 flex-1 grid-cols-7 gap-px sm:gap-1"
        >
          {visibleDates.map((date) => {
            const dateKey = utcDateKey(date);
            const selected = dateKey === selectedDateKey;
            return (
              <button
                key={dateKey}
                type="button"
                data-testid={`sports-live-date-${dateKey}`}
                aria-label={fullDateFormatter.format(date)}
                aria-current={selected ? "date" : undefined}
                className={cn(
                  "flex h-10 min-w-0 cursor-pointer flex-col items-center justify-center rounded-md border px-0.5 py-1 text-[9px] leading-none transition-colors sm:h-12 sm:px-1 sm:py-1.5 sm:text-xs",
                  selected
                    ? "border-zinc-600 bg-zinc-900 text-zinc-100"
                    : "border-transparent text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300",
                )}
                onClick={() => selectDate(date)}
              >
                <span className="whitespace-nowrap">
                  {weekdayFormatter.format(date)}
                </span>
                <span className="mt-1 text-xs font-medium tabular-nums sm:text-sm">
                  {date.getUTCDate()}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label={t("extend.sports.filters.nextWeek")}
          className="flex h-10 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-900/60 hover:text-zinc-200 sm:h-12 sm:w-8"
          onClick={() => selectWeek("next")}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <nav
        ref={taxonomyNavRef}
        data-testid="sports-live-taxonomy-switch"
        aria-label={t("extend.sports.filters.all")}
        className="flex min-w-0 items-center gap-2"
      >
        <HorizontalScrollContainer
          forceShowArrows
          className="min-w-0 flex-1"
          classNames={{
            content: "gap-1.5",
            leftArrow: "from-[#09090b]",
            rightArrow: "from-[#09090b]",
          }}
        >
          <Link
            href={sportsLiveHref(
              section,
              selectedTimeRange,
              selectedLiveRangeStart,
            )}
            onClick={selectAllTaxonomies}
            aria-current={!hasActiveTaxonomy ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-colors",
              !hasActiveTaxonomy
                ? "border-zinc-600 bg-zinc-900 text-zinc-100"
                : "border-zinc-900 bg-zinc-950 text-zinc-500 hover:text-zinc-300",
            )}
          >
            {t("extend.sports.filters.all")}
          </Link>
          {visibleTaxonomyItems.map(({ node, count }) => {
            const taxonomyKey = `${node.node_type}:${node.slug}`;
            const active = taxonomyKey === activeTaxonomyKey;
            return (
              <Link
                key={taxonomyKey}
                href={taxonomyHref(
                  section,
                  node,
                  "live",
                  selectedTimeRange,
                  selectedLiveRangeStart,
                )}
                onClick={(event) => selectTaxonomy(event, node)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "border-zinc-600 bg-zinc-900 text-zinc-100"
                    : "border-zinc-900 bg-zinc-950 text-zinc-500 hover:text-zinc-300",
                )}
              >
                <LocalizedTaxonomyLabel node={node} pageSection={section} />
                {typeof count === "number" && count > 0 && (
                  <span className="tabular-nums text-zinc-500">{count}</span>
                )}
              </Link>
            );
          })}
        </HorizontalScrollContainer>
        {trailingControl && <div className="shrink-0">{trailingControl}</div>}
      </nav>
    </div>
  );
}
