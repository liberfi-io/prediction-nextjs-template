"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useTranslation } from "@liberfi.io/i18n";
import { ChevronLeftIcon, ChevronRightIcon, cn } from "@liberfi.io/ui";
import type {
  SportsMatchCard,
  SportsSection,
  SportsTaxonomyNode,
} from "../types";
import { taxonomyHref } from "../route/sportsTaxonomyNav";
import { LocalizedTaxonomyLabel } from "../i18n/LocalizedTaxonomyLabel";

const SPORTS_LIVE_DATE_COUNT = 7;

export interface SportsLiveTaxonomyItem {
  node: SportsTaxonomyNode;
  active: boolean;
  count?: number;
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
  lang: string;
  onDateChange: (date: Date) => void;
  onToday: () => void;
  previousWeekDisabled: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onTaxonomyNavigate: (
    event: MouseEvent<HTMLAnchorElement>,
    node: SportsTaxonomyNode,
  ) => boolean;
  onAllNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { t } = useTranslation();
  const selectedDateKey = utcDateKey(selectedDate);
  const hasActiveTaxonomy = taxonomyItems.some((item) => item.active);
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

  return (
    <div className="space-y-3 pb-4">
      <div
        data-testid="sports-live-date-picker"
        className="flex w-full max-w-[480px] items-stretch gap-0.5 overflow-hidden sm:gap-1"
      >
        <button
          type="button"
          className="flex h-10 shrink-0 items-center rounded-md px-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-900/60 hover:text-zinc-200 sm:px-2 sm:text-sm"
          onClick={onToday}
        >
          {t("extend.worldcup.tab.today")}
        </button>
        <button
          type="button"
          aria-label={t("extend.sports.filters.previousWeek")}
          className="flex h-10 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-900/60 hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700 disabled:hover:bg-transparent disabled:hover:text-zinc-700 sm:w-8"
          disabled={previousWeekDisabled}
          onClick={onPreviousWeek}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <div
          data-testid="sports-live-date-grid"
          className="grid min-w-0 flex-1 grid-cols-7 gap-px sm:gap-1"
        >
          {dates.map((date) => {
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
                  "flex h-10 min-w-0 flex-col items-center justify-center rounded-md border px-0.5 py-1 text-[10px] leading-none transition-colors sm:text-xs",
                  selected
                    ? "border-zinc-600 bg-zinc-900 text-zinc-100"
                    : "border-transparent text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300",
                )}
                onClick={() => onDateChange(date)}
              >
                <span className="truncate">{weekdayFormatter.format(date)}</span>
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
          className="flex h-10 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-900/60 hover:text-zinc-200 sm:w-8"
          onClick={onNextWeek}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <nav
        data-testid="sports-live-taxonomy-switch"
        aria-label={t("extend.sports.filters.all")}
        className="no-scrollbar flex gap-2 overflow-x-auto"
      >
        <Link
          href={`/${section}?view=live`}
          onClick={onAllNavigate}
          aria-current={!hasActiveTaxonomy ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-lg border px-4 py-2 text-sm transition-colors",
            !hasActiveTaxonomy
              ? "border-zinc-600 bg-zinc-900 text-zinc-100"
              : "border-zinc-900 bg-zinc-950 text-zinc-500 hover:text-zinc-300",
          )}
        >
          {t("extend.sports.filters.all")}
        </Link>
        {taxonomyItems.map(({ node, active, count }) => (
          <Link
            key={`${node.node_type}:${node.slug}`}
            href={taxonomyHref(section, node, "live")}
            onClick={(event) => onTaxonomyNavigate(event, node)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg border px-4 py-2 text-sm transition-colors",
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
        ))}
      </nav>
    </div>
  );
}
