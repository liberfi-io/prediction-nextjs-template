import { NextRequest, NextResponse } from "next/server";
import {
  getMiniAppCaptchaCookieMaxAge,
  getMiniAppCaptchaCookieName,
  isMiniAppCaptchaPlatform,
  signMiniAppCaptchaSession,
} from "src/libs/server/miniAppCaptchaSession";
import {
  readRequestIp,
  verifyTurnstileToken,
} from "src/libs/server/turnstile";

export const runtime = "nodejs";

interface MiniAppCaptchaVerifyRequest {
  token?: unknown;
  platform?: unknown;
}

const TURNSTILE_ACTION = "miniapp-entry";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as
    MiniAppCaptchaVerifyRequest;
  const token = typeof body.token === "string" ? body.token.trim() : "";

  if (!token || !isMiniAppCaptchaPlatform(body.platform)) {
    return NextResponse.json(
      { success: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  const verifyResult = await verifyTurnstileToken({
    token,
    remoteIp: readRequestIp(request.headers),
    expectedAction: TURNSTILE_ACTION,
  });

  if (!verifyResult.success) {
    if (verifyResult.error === "turnstile_unconfigured") {
      return NextResponse.json(
        { success: false, error: "turnstile_unconfigured" },
        { status: 503 },
      );
    }

    console.warn("miniapp captcha verification failed", {
      platform: body.platform,
      error: verifyResult.error,
      errorCodes: verifyResult.errorCodes,
    });
    return NextResponse.json(
      { success: false, error: "turnstile_failed" },
      { status: verifyResult.error === "turnstile_timeout" ? 503 : 403 },
    );
  }

  try {
    const response = NextResponse.json({ success: true });
    response.cookies.set(
      getMiniAppCaptchaCookieName(),
      signMiniAppCaptchaSession({
        platform: body.platform,
        verifiedAt: Math.floor(Date.now() / 1000),
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: getMiniAppCaptchaCookieMaxAge(),
        path: "/",
      },
    );
    return response;
  } catch (error) {
    console.warn("miniapp captcha session signing failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "captcha_session_unconfigured" },
      { status: 503 },
    );
  }
}
