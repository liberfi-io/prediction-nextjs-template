import { NextResponse, type NextRequest } from "next/server";
import type {
  PredictEvent,
  PredictPage,
} from "@liberfi.io/react-predict";
import { filterTradableEventsPage } from "src/lib/filterPredictEvents";

function buildPredictUrl(baseUrl: string, path: string, search: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(normalizedPath, normalizedBase);
  url.search = search;
  return url;
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

  const upstream = await fetch(upstreamUrl, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(request.headers.get("accept-language")
        ? { "accept-language": request.headers.get("accept-language")! }
        : {}),
      ...(request.headers.get("cookie")
        ? { cookie: request.headers.get("cookie")! }
        : {}),
    },
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

  const page = (await upstream.json()) as PredictPage<PredictEvent>;
  return NextResponse.json(filterTradableEventsPage(page));
}
