import type {
  ListEventsParams,
  MarketDataInitialQuotes,
  MarketDataResourceInput,
  MarketStructureResponse,
  PredictEvent,
  PredictPage,
} from "@liberfi.io/react-predict";
import {
  filterMarketStructure,
  marketStructureETag,
  marketStructureValidator,
} from "./structure";
import {
  buildEventMarketDataResource,
  buildEventsMarketDataResource,
} from "./resource";

const STRUCTURE_MEDIA_TYPE =
  "application/vnd.liberfi.market-structure+json;v=1";

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
      Accept: STRUCTURE_MEDIA_TYPE,
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
      Accept: STRUCTURE_MEDIA_TYPE,
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
  });
}
