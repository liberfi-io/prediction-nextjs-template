import { NextResponse, type NextRequest } from "next/server";
import { predictApiHeaders } from "./libs/predictApiHeaders";

/** Authenticate same-origin Prediction API rewrites without changing their paths. */
export function middleware(request: NextRequest) {
  const headers = predictApiHeaders(request.headers);
  if (!headers["x-api-key"]) {
    return NextResponse.json({ error: "prediction_api_key_not_configured" }, { status: 503 });
  }
  return NextResponse.next({ request: { headers: new Headers(headers) } });
}

export const config = { matcher: ["/predict-api/:path*"] };
