import { NextRequest, NextResponse } from "next/server";

/**
 * Sink for client load diagnostics (see `clientDiag.ts`). Logs the snapshot to
 * the server log so Telegram Mini App loads can be traced without on-device
 * devtools. Only receives data when a client explicitly enables `?diag=1`.
 */
const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    if (text && text.length <= MAX_BODY_BYTES) {
      console.info("[diag]", text);
    }
  } catch {
    // never fail a diagnostics beacon
  }
  return new NextResponse(null, { status: 204 });
}
