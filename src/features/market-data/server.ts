import type {
  ListEventsParams,
  MarketDataInitialQuotes,
  MarketDataResourceInput,
  MarketStructureResponse,
  PredictEvent,
  PredictPage,
} from "@liberfi.io/react-predict";
import { filterTradableEventsPage } from "src/lib/filterPredictEvents";
import { resolveSportsMatchRequestView } from "../sports/route/matchRequestView";
import { sportsLiveTimeRange } from "../sports/live/sportsLiveTimeRange";
import type {
  SportsMatchCard,
  SportsMatchDetail,
  SportsPage,
  SportsPageFilters,
  SportsPropEventCard,
  SportsSection,
} from "../sports/types";
import {
  marketStructureETag,
  marketStructureValidator,
  structureFromComposite,
} from "./structure";
import {
  buildEventMarketDataResource,
  buildEventsMarketDataResource,
  buildSportsMarketDataResource,
  type MarketDataSelectedBook,
} from "./resource";

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
  page:
    | {
        items: Array<{
          initial_quotes?: MarketDataInitialQuotes;
        }>;
      }
    | undefined,
): MarketDataInitialQuotes | undefined {
  const markets =
    page?.items.flatMap((event) => event.initial_quotes?.markets ?? []) ?? [];
  return markets.length > 0 ? { schema_version: 1, markets } : undefined;
}

export async function getEventsMarketDataHydration(input: {
  enabled: boolean;
  params: ListEventsParams;
  requestHeaders: HeadersInit;
}): Promise<
  | {
      page: PredictPage<PredictEvent>;
      resource: MarketDataResourceInput;
    }
  | undefined
> {
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
      Accept: "application/json",
    },
  });
  if (!response.ok) return undefined;
  const page = filterTradableEventsPage(
    (await response.json()) as PredictPage<PredictEvent>,
  );
  const structure = structureFromComposite(
    page,
    null,
  ) as unknown as MarketStructureResponse;
  return {
    page,
    resource: buildEventsMarketDataResource({
      structure,
      structureETag: marketStructureETag(
        marketStructureValidator(structure, null),
      ),
      structurePath: `/api/v1/events${search ? `?${search}` : ""}`,
      initialQuotes: initialQuotesFromPage(page),
    }),
  };
}

export async function getEventMarketDataHydration(input: {
  enabled: boolean;
  event: PredictEvent;
  requestHeaders: HeadersInit;
  selectedBook?: MarketDataSelectedBook;
}): Promise<
  { event: PredictEvent; resource: MarketDataResourceInput } | undefined
> {
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
      Accept: "application/json",
    },
  });
  if (!response.ok) return undefined;
  const structureETag = response.headers.get("x-market-structure-etag");
  if (!structureETag) return undefined;
  const event = (await response.json()) as PredictEvent;
  const structure = structureFromComposite(
    { items: [event] },
    null,
  ) as unknown as MarketStructureResponse;
  return {
    event,
    resource: buildEventMarketDataResource({
      structure,
      structureETag,
      structurePath: path,
      event,
      selectedBook: input.selectedBook,
    }),
  };
}

export interface SportsMarketDataHydration {
  matches?: MarketDataResourceInput;
  props?: MarketDataResourceInput;
}

export interface SportsMarketDataHydrationResult {
  resources: SportsMarketDataHydration;
  pages: {
    matches?: SportsPage<SportsMatchCard>;
    props?: SportsPage<SportsPropEventCard>;
  };
}

export async function getSportsMarketDataHydration(input: {
  enabled: boolean;
  section: SportsSection;
  filters: SportsPageFilters;
  lang: string;
  requestHeaders: HeadersInit;
}): Promise<SportsMarketDataHydrationResult | undefined> {
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
            Accept: "application/json",
          },
        },
      );
      if (!response.ok) return undefined;
      const structureETag = response.headers.get("x-market-structure-etag");
      if (!structureETag) return undefined;
      const responseBody = await response.json();
      if (resource === "matches") {
        const page = responseBody as SportsPage<SportsMatchCard>;
        const structure = structureFromComposite(
          page,
          null,
        ) as unknown as MarketStructureResponse;
        return {
          resource,
          page,
          marketDataResource: buildSportsMarketDataResource({
            section: input.section,
            resource,
            structure,
            structureETag,
            structurePath: path,
            initialQuotes: initialQuotesFromPage(page),
          }),
        } as const;
      }
      const page = responseBody as SportsPage<SportsPropEventCard>;
      const structure = structureFromComposite(
        page,
        null,
      ) as unknown as MarketStructureResponse;
      return {
        resource,
        page,
        marketDataResource: buildSportsMarketDataResource({
          section: input.section,
          resource,
          structure,
          structureETag,
          structurePath: path,
          initialQuotes: initialQuotesFromPage(page),
        }),
      } as const;
    }),
  );
  const result: SportsMarketDataHydrationResult = {
    resources: {},
    pages: {},
  };
  for (const entry of entries) {
    if (!entry) continue;
    if (entry.resource === "matches") {
      result.resources.matches = entry.marketDataResource;
      result.pages.matches = entry.page;
    } else {
      result.resources.props = entry.marketDataResource;
      result.pages.props = entry.page;
    }
  }
  return result;
}

export async function getSportsMatchMarketDataHydration(input: {
  enabled: boolean;
  match: SportsMatchDetail;
  lang: string;
  requestHeaders: HeadersInit;
  selectedBook?: MarketDataSelectedBook;
}): Promise<
  { match: SportsMatchDetail; resource: MarketDataResourceInput } | undefined
> {
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
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) return undefined;
  const structureETag = response.headers.get("x-market-structure-etag");
  if (!structureETag) return undefined;
  const match = (await response.json()) as SportsMatchDetail;
  const structure = structureFromComposite(
    { items: [match] },
    null,
  ) as unknown as MarketStructureResponse;
  return {
    match,
    resource: buildSportsMarketDataResource({
      section: input.match.section,
      resource: "detail",
      structure,
      structureETag,
      structurePath: path,
      initialQuotes: match.initial_quotes,
      selectedBook: input.selectedBook,
    }),
  };
}
