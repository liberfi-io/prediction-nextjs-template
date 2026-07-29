import {
  type MarketDataInitialQuotes,
  type MarketDataResourceInput,
  type MarketStructureResponse,
} from "@liberfi.io/react-predict";
import type {
  SportsPage,
  SportsSection,
  SportsTaxonomyMatchCount,
  TaxonomySelection,
} from "../types";
import type { SportsLiveTimeRange } from "../live/sportsLiveTimeRange";
import {
  appendSportsLiveTimeRange,
  normalizeSportsTaxonomyCounts,
  SPORTS_TAXONOMY_COUNTS_PATH,
} from "./sportsTaxonomyCounts";
import { MARKET_STRUCTURE_MEDIA_TYPE_V1 } from "../../market-data/constants";
import { buildSportsMarketDataResource } from "../../market-data/resource";

export interface SportsPageRequest {
  section: SportsSection;
  resource: "matches" | "props";
  view?: "live" | "upcoming" | "results";
  taxonomy?: TaxonomySelection;
  timeRange?: SportsLiveTimeRange;
  limit: number;
  cursor?: string;
  lang?: string;
  signal?: AbortSignal;
}

function sportsPagePath(input: SportsPageRequest): string {
  const search = new URLSearchParams();
  if (input.taxonomy) {
    search.set("taxonomy_type", input.taxonomy.taxonomy_type);
    search.set("taxonomy_slug", input.taxonomy.taxonomy_slug);
  }
  if (input.view && input.resource === "matches") {
    search.set("view", input.view);
  }
  if (input.timeRange) {
    search.set("start_time_gte", input.timeRange.start_time_gte);
    search.set("start_time_lt", input.timeRange.start_time_lt);
  }
  search.set("limit", String(input.limit));
  if (input.cursor) search.set("cursor", input.cursor);
  if (input.lang) search.set("lang", input.lang);
  return `/api/v1/${input.section}/${input.resource}?${search.toString()}`;
}

function sportsPageUrl(input: SportsPageRequest): URL {
  const baseUrl = process.env.NEXT_PUBLIC_PREDICT_URL ?? "/predict-api";
  return new URL(`${baseUrl}${sportsPagePath(input)}`, window.location.origin);
}

/** Loads a sports page with optional view, taxonomy, time-range, and cursor filters. */
export async function fetchSportsPage<T>(
  input: SportsPageRequest,
): Promise<SportsPage<T>> {
  const response = await fetch(sportsPageUrl(input), {
    signal: input.signal,
  });
  if (!response.ok) throw new Error(`Sports API returned ${response.status}`);
  const page = (await response.json()) as SportsPage<T>;
  return {
    ...page,
    items: page.items ?? [],
    has_more: Boolean(page.has_more && page.next_cursor),
  };
}

function pageInitialQuotes<T>(
  page: SportsPage<T>,
): MarketDataInitialQuotes | undefined {
  const markets = page.items.flatMap((item) => {
    const candidate = item as {
      initial_quotes?: MarketDataInitialQuotes;
    };
    return candidate.initial_quotes?.markets ?? [];
  });
  return markets.length > 0 ? { schema_version: 1, markets } : undefined;
}

async function fetchSportsMarketDataResource<T>(
  input: SportsPageRequest,
  page: SportsPage<T>,
): Promise<MarketDataResourceInput | undefined> {
  const response = await fetch(sportsPageUrl(input), {
    cache: "no-store",
    headers: { Accept: MARKET_STRUCTURE_MEDIA_TYPE_V1 },
    signal: input.signal,
  });
  if (!response.ok) return undefined;
  const etag = response.headers.get("etag");
  if (!etag) return undefined;
  return buildSportsMarketDataResource({
    section: input.section,
    resource: input.resource,
    structure: (await response.json()) as MarketStructureResponse,
    structureETag: etag,
    structurePath: sportsPagePath(input),
    initialQuotes: pageInitialQuotes(page),
  });
}

/** Loads a page and its exact market-data structure generation when enabled. */
export async function fetchSportsPageWithMarketData<T>(
  input: SportsPageRequest & { marketDataEnabled: boolean },
): Promise<{
  page: SportsPage<T>;
  marketDataResource?: MarketDataResourceInput;
}> {
  const page = await fetchSportsPage<T>(input);
  if (!input.marketDataEnabled || input.signal?.aborted) return { page };
  const marketDataResource = await fetchSportsMarketDataResource(
    input,
    page,
  ).catch(() => undefined);
  return { page, marketDataResource };
}

/** Loads sports taxonomy match counts for a product view and optional time range. */
export async function fetchSportsTaxonomyCounts(
  timeRange?: SportsLiveTimeRange,
  view: "live" | "upcoming" | "results" = "live",
  signal?: AbortSignal,
): Promise<SportsTaxonomyMatchCount[]> {
  const baseUrl = process.env.NEXT_PUBLIC_PREDICT_URL ?? "/predict-api";
  const url = new URL(
    `${baseUrl}${SPORTS_TAXONOMY_COUNTS_PATH}`,
    window.location.origin,
  );
  if (timeRange) appendSportsLiveTimeRange(url, timeRange);
  url.searchParams.set("view", view);

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Sports API returned ${response.status}`);
  return normalizeSportsTaxonomyCounts(await response.json());
}
