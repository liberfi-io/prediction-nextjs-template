import { getServerPredictClient } from "src/libs/server/predictClient";
import type {
  SportsPageData,
  SportsPageFilters,
  SportsSection,
  SportsTaxonomyMatchCount,
  SportsTaxonomyResponse,
} from "../types";
import type { SportsSsrDeadline } from "../route/sportsSsrDeadline";
import {
  sportsLiveTimeRange,
  type SportsLiveTimeRange,
} from "../live/sportsLiveTimeRange";
import {
  appendSportsLiveTimeRange,
  normalizeSportsTaxonomyCounts,
  SPORTS_TAXONOMY_COUNTS_PATH,
} from "./sportsTaxonomyCounts";

type RuntimeSportsClient = {
  getSportsTaxonomy?: (params: Record<string, unknown>) => Promise<unknown>;
};

interface PageResponse<T> {
  items?: T[];
  next_cursor?: string | null;
  has_more?: boolean;
  limit?: number;
}

const DEFAULT_LIMIT = 20;

export async function prefetchSportsPageData(input: {
  section: SportsSection;
  lang: string;
  requestHeaders?: HeadersInit;
  deadline: SportsSsrDeadline;
  filters?: SportsPageFilters;
}): Promise<SportsPageData> {
  const client = getServerPredictClient({
    headers: input.requestHeaders,
  }) as RuntimeSportsClient;
  const apiFilters = { ...(input.filters ?? {}) };
  delete apiFilters.view;
  delete apiFilters.start_time_gte;
  delete apiFilters.start_time_lt;
  const params = {
    ...apiFilters,
    ...(input.lang ? { lang: input.lang } : {}),
  };

  const readTaxonomy = client.getSportsTaxonomy;
  const hasTaxonomyFilter = Boolean(
    input.filters?.taxonomy_type && input.filters.taxonomy_slug,
  );
  const isLiveView =
    input.filters?.view === "live" ||
    (!input.filters?.view && !hasTaxonomyFilter);
  const requestedLiveTimeRange =
    input.filters?.start_time_gte && input.filters.start_time_lt
      ? {
          start_time_gte: input.filters.start_time_gte,
          start_time_lt: input.filters.start_time_lt,
        }
      : undefined;
  const liveTimeRange = isLiveView
    ? (requestedLiveTimeRange ?? sportsLiveTimeRange(new Date()))
    : undefined;
  const matchParams = {
    ...params,
    ...liveTimeRange,
  };
  const showMatches = input.filters?.view !== "proposals";
  const showProps =
    input.filters?.view === "proposals" ||
    (hasTaxonomyFilter && input.filters?.view !== "live");

  const [taxonomy, matches, props, matchTaxonomyCounts] = await Promise.all([
    input.deadline
      .withRemainingTimeout(
        () => readTaxonomy?.call(client, params) ?? Promise.resolve(null),
      )
      .catch(() => null),
    input.deadline
      .withRemainingTimeout(() =>
        showMatches
          ? readSportsPage(input.section, "matches", matchParams)
          : Promise.resolve({ items: [] }),
      )
      .catch(() => ({ items: [] })),
    input.deadline
      .withRemainingTimeout(() =>
        showProps
          ? readSportsPage(input.section, "props", params)
          : Promise.resolve({ items: [] }),
      )
      .catch(() => ({ items: [] })),
    input.section === "sports" && liveTimeRange
      ? input.deadline
          .withRemainingTimeout(() =>
            readSportsTaxonomyCounts(liveTimeRange),
          )
          .catch(() => ({ items: [] }))
      : Promise.resolve(undefined),
  ]);

  const matchPage = normalizePage<SportsPageData["matches"][number]>(matches);
  const propPage = normalizePage<SportsPageData["props"][number]>(props);
  return {
    taxonomy: taxonomy as SportsTaxonomyResponse | null,
    matches: matchPage.items,
    props: propPage.items,
    match_taxonomy_counts: normalizeTaxonomyCounts(matchTaxonomyCounts),
    match_pagination: paginationFromPage(matchPage),
    prop_pagination: paginationFromPage(propPage),
  };
}

async function readSportsTaxonomyCounts(
  params: SportsLiveTimeRange,
): Promise<unknown> {
  const url = new URL(
    SPORTS_TAXONOMY_COUNTS_PATH,
    ensureTrailingSlash(process.env.PREDICT_URL!),
  );
  appendSportsLiveTimeRange(url, params);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Sports API returned ${response.status}`);
  return response.json();
}

function normalizeTaxonomyCounts(
  value: unknown,
): SportsTaxonomyMatchCount[] | undefined {
  if (value === undefined) return undefined;
  return normalizeSportsTaxonomyCounts(value);
}

function paginationFromPage<T>({
  items: _items,
  ...pagination
}: ReturnType<typeof normalizePage<T>>) {
  return pagination;
}

async function readSportsPage(
  section: SportsSection,
  resource: "matches" | "props",
  params: Record<string, unknown>,
): Promise<unknown> {
  const url = new URL(
    `/api/v1/${section}/${resource}`,
    ensureTrailingSlash(process.env.PREDICT_URL!),
  );
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Sports API returned ${response.status}`);
  return response.json();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizePage<T>(value: unknown) {
  const page = value as PageResponse<T>;
  return {
    items: page.items ?? [],
    next_cursor: page.next_cursor,
    has_more: Boolean(page.has_more && page.next_cursor),
    limit: page.limit ?? DEFAULT_LIMIT,
  };
}
