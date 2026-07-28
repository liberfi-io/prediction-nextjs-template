import { NextResponse, type NextRequest } from "next/server";
import type { PredictEvent, PredictPage } from "@liberfi.io/react-predict";
import { filterTradableEventsPage } from "src/lib/filterPredictEvents";
import {
  filterMarketStructure,
  marketStructureETag,
  marketStructureValidator,
} from "src/features/market-data/structure";
import { MARKET_STRUCTURE_MEDIA_TYPE_V1 } from "src/features/market-data/constants";

function buildPredictUrl(baseUrl: string, path: string, search: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(normalizedPath, normalizedBase);
  url.search = search;
  return url;
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
    request.headers.get("accept") === MARKET_STRUCTURE_MEDIA_TYPE_V1;

  const upstream = await fetch(upstreamUrl, {
    cache: "no-store",
    headers: forwardingHeaders(
      request,
      structureRequested ? MARKET_STRUCTURE_MEDIA_TYPE_V1 : "application/json",
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
    const structure = filterMarketStructure(await upstream.json());
    const etag = marketStructureETag(
      marketStructureValidator(structure, upstream.headers.get("etag")),
    );
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
        "content-type": MARKET_STRUCTURE_MEDIA_TYPE_V1,
      },
    });
  }

  const page = (await upstream.json()) as PredictPage<PredictEvent>;
  const withMarkets = request.nextUrl.searchParams.get("with_markets");
  const requireMarkets = withMarkets !== "false" && withMarkets !== "0";
  const filtered = filterTradableEventsPage(page, { requireMarkets });
  const structure = marketStructureValidator(
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
