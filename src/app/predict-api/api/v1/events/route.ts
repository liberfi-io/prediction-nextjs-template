import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { PredictEvent, PredictPage } from "@liberfi.io/react-predict";
import { filterTradableEventsPage } from "src/lib/filterPredictEvents";

const STRUCTURE_MEDIA_TYPE =
  "application/vnd.liberfi.market-structure+json;v=1";

type JsonRecord = Record<string, unknown>;

function buildPredictUrl(baseUrl: string, path: string, search: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(normalizedPath, normalizedBase);
  url.search = search;
  return url;
}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object"
    ? (value as JsonRecord)
    : {};
}

function structuralOutcome(value: unknown): JsonRecord {
  const outcome = asRecord(value);
  return {
    key: outcome.key,
    label: outcome.label,
    ...(outcome.label_trans ? { label_trans: outcome.label_trans } : {}),
    quote_capable: outcome.quote_capable,
    orderbook_capable: outcome.orderbook_capable,
    price_history_supported: outcome.price_history_supported,
    ...(outcome.book_channel ? { book_channel: outcome.book_channel } : {}),
  };
}

function structuralMarket(value: unknown): JsonRecord {
  const market = asRecord(value);
  return {
    source: market.source,
    market_slug: market.market_slug ?? market.slug,
    question: market.question,
    ...(market.question_trans ? { question_trans: market.question_trans } : {}),
    status: market.status,
    realtime_supported: market.realtime_supported,
    realtime_book_supported: market.realtime_book_supported,
    outcomes: Array.isArray(market.outcomes)
      ? market.outcomes.map(structuralOutcome)
      : [],
  };
}

function structuralEvent(value: unknown): JsonRecord {
  const event = asRecord(value);
  const markets = Array.isArray(event.markets)
    ? event.markets.filter((market) => asRecord(market).status === "open")
    : [];
  return {
    resource_type: event.resource_type ?? "event",
    source: event.source,
    resource_slug: event.resource_slug ?? event.slug,
    ...(event.section ? { section: event.section } : {}),
    title: event.title,
    ...(event.title_trans ? { title_trans: event.title_trans } : {}),
    status: event.status,
    market_view: event.market_view ?? "full",
    markets_included: event.markets_included ?? true,
    ...(event.item_channel ? { item_channel: event.item_channel } : {}),
    markets: markets.map(structuralMarket),
  };
}

function structureFromComposite(
  page: PredictPage<PredictEvent>,
  upstreamStructureETag: string | null,
): JsonRecord {
  return {
    representation_schema_version: 1,
    initial_quotes_contract_enabled:
      asRecord(page).initial_quotes_contract_enabled ??
      page.items.some((item) => Boolean(asRecord(item).initial_quotes)),
    ...(upstreamStructureETag
      ? { upstream_structure_version: upstreamStructureETag }
      : {}),
    items: page.items.map(structuralEvent),
  };
}

function filterStructure(value: unknown): JsonRecord {
  const structure = asRecord(value);
  const items = Array.isArray(structure.items)
    ? structure.items
        .filter((item) => asRecord(item).status === "open")
        .map(structuralEvent)
        .filter((item) => {
          const marketsIncluded = item.markets_included !== false;
          return !marketsIncluded || (item.markets as unknown[]).length > 0;
        })
    : [];
  return {
    representation_schema_version: structure.representation_schema_version,
    initial_quotes_contract_enabled: structure.initial_quotes_contract_enabled,
    items,
  };
}

function marketStructureETag(structure: JsonRecord): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(structure))
    .digest("base64url");
  return `W/"market-structure-v1-${digest}"`;
}

function forwardingHeaders(request: NextRequest, accept: string) {
  return {
    accept,
    ...(request.headers.get("accept-language")
      ? { "accept-language": request.headers.get("accept-language")! }
      : {}),
    ...(request.headers.get("cookie")
      ? { cookie: request.headers.get("cookie")! }
      : {}),
  };
}

export async function GET(request: NextRequest) {
  const baseUrl = process.env.PREDICT_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "PREDICT_URL is not configured" },
      { status: 500 },
    );
  }

  const upstreamUrl = buildPredictUrl(
    baseUrl,
    "/api/v1/events",
    request.nextUrl.search,
  );
  const structureRequested =
    request.headers.get("accept") === STRUCTURE_MEDIA_TYPE;

  const upstream = await fetch(upstreamUrl, {
    cache: "no-store",
    headers: forwardingHeaders(
      request,
      structureRequested ? STRUCTURE_MEDIA_TYPE : "application/json",
    ),
  });

  if (!upstream.ok) {
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
      },
    });
  }

  if (structureRequested) {
    const structure = filterStructure(await upstream.json());
    const etag = marketStructureETag(structure);
    const headers = {
      "cache-control": "no-store",
      etag,
      vary: "Accept",
    };
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers });
    }
    return NextResponse.json(structure, {
      headers: {
        ...headers,
        "content-type": STRUCTURE_MEDIA_TYPE,
      },
    });
  }

  const page = (await upstream.json()) as PredictPage<PredictEvent>;
  const withMarkets = request.nextUrl.searchParams.get("with_markets");
  const requireMarkets = withMarkets !== "false" && withMarkets !== "0";
  const filtered = filterTradableEventsPage(page, { requireMarkets });
  const structure = structureFromComposite(
    filtered,
    upstream.headers.get("x-market-structure-etag"),
  );
  return NextResponse.json(filtered, {
    headers: {
      "cache-control": "private, no-store",
      "x-market-structure-etag": marketStructureETag(structure),
    },
  });
}
