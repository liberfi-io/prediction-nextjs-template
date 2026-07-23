import type { SportsPageFilters, TaxonomyType } from "../types";

export type SportsPageSearchParams = Record<
  string,
  string | string[] | undefined
>;

const TAXONOMY_TYPES = new Set<SportsPageFilters["taxonomy_type"]>([
  "sport",
  "game",
  "league",
  "tournament",
]);

const SPORTS_VIEWS = new Set<SportsPageFilters["view"]>(["live", "proposals"]);
const RFC3339_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;

export function resolveSportsPageFilters(
  searchParams: SportsPageSearchParams,
): SportsPageFilters {
  const view = firstValue(searchParams.view);
  const viewFilter = SPORTS_VIEWS.has(view as SportsPageFilters["view"])
    ? { view: view as SportsPageFilters["view"] }
    : {};
  const rangeFilter = resolveLiveRangeFilter(searchParams, viewFilter.view);
  const taxonomyType = firstValue(searchParams.taxonomy_type);
  const taxonomySlug = firstValue(searchParams.taxonomy_slug);
  if (
    TAXONOMY_TYPES.has(taxonomyType as SportsPageFilters["taxonomy_type"]) &&
    taxonomySlug
  ) {
    return {
      ...viewFilter,
      ...rangeFilter,
      taxonomy_type: taxonomyType as TaxonomyType,
      taxonomy_slug: taxonomySlug,
    };
  }
  return { ...viewFilter, ...rangeFilter };
}

function resolveLiveRangeFilter(
  searchParams: SportsPageSearchParams,
  view: SportsPageFilters["view"],
): Pick<SportsPageFilters, "start_time_gte" | "start_time_lt"> {
  if (view !== "live") return {};
  const startTimeGte = firstValue(searchParams.start_time_gte);
  const startTimeLt = firstValue(searchParams.start_time_lt);
  if (!startTimeGte || !startTimeLt) return {};
  const lowerBound = Date.parse(startTimeGte);
  const upperBound = Date.parse(startTimeLt);
  if (
    !isValidRfc3339(startTimeGte) ||
    !isValidRfc3339(startTimeLt) ||
    !Number.isFinite(lowerBound) ||
    !Number.isFinite(upperBound) ||
    lowerBound >= upperBound
  ) {
    return {};
  }
  return {
    start_time_gte: startTimeGte,
    start_time_lt: startTimeLt,
  };
}

function isValidRfc3339(value: string): boolean {
  const match = RFC3339_PATTERN.exec(value);
  if (!match) return false;
  const [
    ,
    yearValue,
    monthValue,
    dayValue,
    hourValue,
    minuteValue,
    secondValue,
    offsetHourValue = "0",
    offsetMinuteValue = "0",
  ] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const offsetHour = Number(offsetHourValue);
  const offsetMinute = Number(offsetMinuteValue);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (daysInMonth[month - 1] ?? 0) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0] || undefined;
  return value || undefined;
}
