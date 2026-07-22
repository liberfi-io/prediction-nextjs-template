"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
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

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns the seven local calendar dates shown by the live list. */
export function sportsLiveDates(start: Date): Date[] {
  const firstDate = startOfLocalDay(start);
  return Array.from({ length: SPORTS_LIVE_DATE_COUNT }, (_, index) => {
    const date = new Date(firstDate);
    date.setDate(date.getDate() + index);
    return date;
  });
}

/** Formats the date range carried by the live-list title. */
export function formatSportsLiveDateRange(dates: Date[], lang: string): string {
  const start = dates[0];
  const end = dates[dates.length - 1];
  if (!start || !end) return "";
  const crossesYear = start.getFullYear() !== end.getFullYear();
  const startLabel = new Intl.DateTimeFormat(lang, {
    month: "short",
    day: "numeric",
    ...(crossesYear ? { year: "numeric" } : {}),
  }).format(start);
  const endLabel = new Intl.DateTimeFormat(lang, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(end);
  return `${startLabel} – ${endLabel}`;
}

/** Returns matches whose start time falls on the selected local date. */
export function matchesForDate(
  matches: SportsMatchCard[],
  date: Date,
): SportsMatchCard[] {
  const start = startOfLocalDay(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return matches.filter((match) => {
    const timestamp = Date.parse(match.start_time ?? "");
    return timestamp >= start.getTime() && timestamp < end.getTime();
  });
}

/** Renders live-list date controls and first-level taxonomy switches. */
export function SportsLiveFilters({
  section,
  taxonomyItems,
  dates,
  selectedDate,
  lang,
  onDateChange,
  onTaxonomyNavigate,
  onAllNavigate,
}: {
  section: SportsSection;
  taxonomyItems: SportsLiveTaxonomyItem[];
  dates: Date[];
  selectedDate: Date;
  lang: string;
  onDateChange: (date: Date) => void;
  onTaxonomyNavigate: (
    event: MouseEvent<HTMLAnchorElement>,
    node: SportsTaxonomyNode,
  ) => boolean;
  onAllNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { t } = useTranslation();
  const selectedDateKey = localDateKey(selectedDate);
  const hasActiveTaxonomy = taxonomyItems.some((item) => item.active);
  const fullDateFormatter = new Intl.DateTimeFormat(lang, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const weekdayFormatter = new Intl.DateTimeFormat(lang, {
    weekday: "short",
  });

  return (
    <div className="space-y-3 pb-4">
      <div
        data-testid="sports-live-date-picker"
        className="no-scrollbar flex items-stretch gap-1 overflow-x-auto"
      >
        <span className="flex shrink-0 items-center px-2 text-sm text-zinc-400">
          {t("extend.worldcup.tab.today")}
        </span>
        {dates.map((date) => {
          const dateKey = localDateKey(date);
          const selected = dateKey === selectedDateKey;
          return (
            <button
              key={dateKey}
              type="button"
              data-testid={`sports-live-date-${dateKey}`}
              aria-label={fullDateFormatter.format(date)}
              aria-current={selected ? "date" : undefined}
              className={cn(
                "flex min-w-14 shrink-0 flex-col items-center rounded-lg border px-3 py-1.5 text-xs transition-colors",
                selected
                  ? "border-zinc-600 bg-zinc-900 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300",
              )}
              onClick={() => onDateChange(date)}
            >
              <span>{weekdayFormatter.format(date)}</span>
              <span className="mt-0.5 text-sm font-medium tabular-nums">
                {date.getDate()}
              </span>
            </button>
          );
        })}
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
