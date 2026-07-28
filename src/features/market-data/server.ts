import type {
  ListEventsParams,
  MarketDataInitialQuotes,
  MarketDataResourceInput,
  MarketStructureResponse,
  PredictEvent,
  PredictPage,
} from "@liberfi.io/react-predict";
import { resolveSportsMatchRequestView } from "../sports/route/matchRequestView";
import { sportsLiveTimeRange } from "../sports/live/sportsLiveTimeRange";
import type {
  SportsPageData,
  SportsPageFilters,
  SportsSection,
} from "../sports/types";
import {
  filterMarketStructure,
  marketStructureETag,
  marketStructureValidator,
} from "./structure";
import {
  buildEventMarketDataResource,
  buildEventsMarketDataResource,
  buildSportsMarketDataResource,
  type MarketDataSelectedBook,
} from "./resource";
import { MARKET_STRUCTURE_MEDIA_TYPE_V1 } from "./constants";

export function buildPredictApiUrl(baseUrl: string, path: string): URL {
  return new URL(path.replace(/^\/+/, ""), `${baseUrl.replace(/\/+$/, "")}/`);
}

function eventsSearch(params: ListEventsParams): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  return search.toString();
}

function recordSearch(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  return search.toString();
}

function initialQuotesFromPage(
  page: PredictPage<PredictEvent> | undefined,
): MarketDataInitialQuotes | undefined {
  const markets =
    page?.items.flatMap((event) => event.initial_quotes?.markets ?? []) ?? [];
  return markets.length > 0 ? { schema_version: 1, markets } : undefined;
}

export async function getEventsMarketDataHydration(input: {
  enabled: boolean;
  params: ListEventsParams;
  requestHeaders: HeadersInit;
  page?: PredictPage<PredictEvent>;
}): Promise<MarketDataResourceInput | undefined> {
  if (!input.enabled) return undefined;
  const baseUrl = process.env.PREDICT_URL;
  if (!baseUrl) return undefined;
  const search = eventsSearch(input.params);
  const url = buildPredictApiUrl(baseUrl, "/api/v1/events");
  url.search = search;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      ...Object.fromEntries(new Headers(input.requestHeaders)),
      Accept: MARKET_STRUCTURE_MEDIA_TYPE_V1,
    },
  });
  if (!response.ok) return undefined;
  const structure = filterMarketStructure(
    await response.json(),
  ) as unknown as MarketStructureResponse;
  const etag = marketStructureETag(
    marketStructureValidator(structure, response.headers.get("etag")),
  );
  return buildEventsMarketDataResource({
    structure,
    structureETag: etag,
    structurePath: `/api/v1/events${search ? `?${search}` : ""}`,
    initialQuotes: initialQuotesFromPage(input.page),
  });
}

export async function getEventMarketDataHydration(input: {
  enabled: boolean;
  event: PredictEvent;
  requestHeaders: HeadersInit;
  selectedBook?: MarketDataSelectedBook;
}): Promise<MarketDataResourceInput | undefined> {
  if (!input.enabled) return undefined;
  const baseUrl = process.env.PREDICT_URL;
  if (!baseUrl) return undefined;
  const path =
    `/api/v1/events/${encodeURIComponent(input.event.slug)}` +
    `?source=${encodeURIComponent(input.event.source)}`;
  const response = await fetch(buildPredictApiUrl(baseUrl, path), {
    cache: "no-store",
    headers: {
      ...Object.fromEntries(new Headers(input.requestHeaders)),
      Accept: MARKET_STRUCTURE_MEDIA_TYPE_V1,
    },
  });
  if (!response.ok) return undefined;
  const structure = (await response.json()) as MarketStructureResponse;
  const etag = response.headers.get("etag");
  if (!etag) return undefined;
  return buildEventMarketDataResource({
    structure,
    structureETag: etag,
    structurePath: path,
    event: input.event,
    selectedBook: input.selectedBook,
  });
}

export interface SportsMarketDataHydration {
  matches?: MarketDataResourceInput;
  props?: MarketDataResourceInput;
}

function sportsInitialQuotes(
  data: SportsPageData,
  resource: "matches" | "props",
): MarketDataInitialQuotes | undefined {
  const items = resource === "matches" ? data.matches : data.props;
  const markets = items.flatMap((item) => item.initial_quotes?.markets ?? []);
  return markets.length > 0 ? { schema_version: 1, markets } : undefined;
}

export async function getSportsMarketDataHydration(input: {
  enabled: boolean;
  section: SportsSection;
  filters: SportsPageFilters;
  lang: string;
  requestHeaders: HeadersInit;
  data: SportsPageData;
}): Promise<SportsMarketDataHydration | undefined> {
  if (!input.enabled || !process.env.PREDICT_URL) return undefined;
  const common: Record<string, unknown> = {
    ...(input.filters.taxonomy_type
      ? {
          taxonomy_type: input.filters.taxonomy_type,
          taxonomy_slug: input.filters.taxonomy_slug,
        }
      : {}),
    ...(input.lang ? { lang: input.lang } : {}),
  };
  const matchView = resolveSportsMatchRequestView(input.filters);
  const requestedRange =
    input.filters.start_time_gte && input.filters.start_time_lt
      ? {
          start_time_gte: input.filters.start_time_gte,
          start_time_lt: input.filters.start_time_lt,
        }
      : undefined;
  const matchRange =
    requestedRange ??
    (matchView === "live" ? sportsLiveTimeRange(new Date()) : undefined);
  const descriptors = [
    ...(input.filters.view !== "proposals"
      ? [
          {
            resource: "matches" as const,
            params: {
              ...common,
              ...(matchView ? { view: matchView } : {}),
              ...matchRange,
            },
          },
        ]
      : []),
    ...(input.filters.view === "proposals" ||
    Boolean(input.filters.taxonomy_type && !matchView)
      ? [{ resource: "props" as const, params: common }]
      : []),
  ];
  const entries = await Promise.all(
    descriptors.map(async ({ resource, params }) => {
      const search = recordSearch(params);
      const path =
        `/api/v1/${input.section}/${resource}` + (search ? `?${search}` : "");
      const response = await fetch(
        buildPredictApiUrl(process.env.PREDICT_URL!, path),
        {
          cache: "no-store",
          headers: {
            ...Object.fromEntries(new Headers(input.requestHeaders)),
            Accept: MARKET_STRUCTURE_MEDIA_TYPE_V1,
          },
        },
      );
      if (!response.ok) return [resource, undefined] as const;
      const etag = response.headers.get("etag");
      if (!etag) return [resource, undefined] as const;
      const structure = (await response.json()) as MarketStructureResponse;
      return [
        resource,
        buildSportsMarketDataResource({
          section: input.section,
          resource,
          structure,
          structureETag: etag,
          structurePath: path,
          initialQuotes: sportsInitialQuotes(input.data, resource),
        }),
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as SportsMarketDataHydration;
}

export async function getSportsMatchMarketDataHydration(input: {
  enabled: boolean;
  match: import("../sports/types").SportsMatchDetail;
  lang: string;
  requestHeaders: HeadersInit;
  selectedBook?: MarketDataSelectedBook;
}): Promise<MarketDataResourceInput | undefined> {
  if (!input.enabled || !process.env.PREDICT_URL) return undefined;
  const search = recordSearch(input.lang ? { lang: input.lang } : {});
  const path =
    `/api/v1/${input.match.section}/matches/` +
    `${encodeURIComponent(input.match.match_group_slug)}` +
    (search ? `?${search}` : "");
  const response = await fetch(
    buildPredictApiUrl(process.env.PREDICT_URL, path),
    {
      cache: "no-store",
      headers: {
        ...Object.fromEntries(new Headers(input.requestHeaders)),
        Accept: MARKET_STRUCTURE_MEDIA_TYPE_V1,
      },
    },
  );
  if (!response.ok) return undefined;
  const etag = response.headers.get("etag");
  if (!etag) return undefined;
  return buildSportsMarketDataResource({
    section: input.match.section,
    resource: "detail",
    structure: (await response.json()) as MarketStructureResponse,
    structureETag: etag,
    structurePath: path,
    initialQuotes: input.match.initial_quotes,
    selectedBook: input.selectedBook,
  });
}
