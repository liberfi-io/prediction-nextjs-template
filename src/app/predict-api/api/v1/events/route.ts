import { NextResponse, type NextRequest } from "next/server";
import type {
  PredictEvent,
  PredictPage,
} from "@liberfi.io/react-predict";
import { filterTradableEventsPage } from "src/lib/filterPredictEvents";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.PREDICT_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "PREDICT_URL is not configured" },
      { status: 500 },
    );
  }

  const upstreamUrl = new URL("/api/v1/events", baseUrl);
  upstreamUrl.search = request.nextUrl.search;

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
