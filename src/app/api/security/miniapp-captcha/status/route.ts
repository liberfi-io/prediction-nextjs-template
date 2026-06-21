import { NextRequest, NextResponse } from "next/server";
import {
  getMiniAppCaptchaCookieName,
  verifyMiniAppCaptchaSession,
} from "src/libs/server/miniAppCaptchaSession";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(getMiniAppCaptchaCookieName())?.value;
  if (!token) {
    return NextResponse.json({ verified: false });
  }

  try {
    const session = verifyMiniAppCaptchaSession(token);
    return NextResponse.json({
      verified: true,
      platform: session.platform,
    });
  } catch {
    return NextResponse.json({ verified: false });
  }
}
