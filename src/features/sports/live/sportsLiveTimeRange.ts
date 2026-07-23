export interface SportsLiveTimeRange {
  start_time_gte: string;
  start_time_lt: string;
}

function formatUtcRfc3339(value: Date): string {
  return value.toISOString().replace(".000Z", "Z");
}

/** Returns a one-day UTC half-open range for the supplied calendar date. */
export function sportsLiveTimeRange(start: Date): SportsLiveTimeRange {
  const lowerBound = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const upperBound = new Date(lowerBound);
  upperBound.setUTCDate(upperBound.getUTCDate() + 1);
  return {
    start_time_gte: formatUtcRfc3339(lowerBound),
    start_time_lt: formatUtcRfc3339(upperBound),
  };
}
