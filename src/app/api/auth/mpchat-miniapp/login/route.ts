import { NextRequest, NextResponse } from "next/server";
import {
  getMpChatSessionCookieName,
  getMpChatSessionMaxAge,
  getMpChatSessionSecret,
  numberFromEnv,
  signMpChatSession,
  verifyMpChatMiniAppInitData,
  verifyMpChatSession,
  type VerifiedMpChatMiniAppContext,
} from "src/libs/server/mpChatMiniApp";
import { signMpChatPrivyJwt } from "src/libs/server/mpChatPrivyJwt";

interface MpChatMiniAppLoginRequest {
  initData?: string;
  startParam?: string;
}

const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 300;

export async function POST(request: NextRequest) {
  const botToken = process.env.MPCHAT_BOT_TOKEN;
  const botUsername = process.env.MPCHAT_BOT_USERNAME;
  if (!botToken || !botUsername || !process.env.MPCHAT_PRIVY_JWT_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "MPCHAT_LOGIN_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as MpChatMiniAppLoginRequest;
    const cookieName = getMpChatSessionCookieName();
    const sessionToken = request.cookies.get(cookieName)?.value;
    const sessionSecret = getMpChatSessionSecret(botToken);
    let context: VerifiedMpChatMiniAppContext | null = null;
    let shouldRefreshSessionCookie = false;

    if (sessionToken) {
      try {
        context = verifyMpChatSession(sessionToken, sessionSecret);
      } catch {
        context = null;
      }
    }

    if (!context) {
      if (!body.initData?.trim()) {
        return NextResponse.json(
          { error: "MPCHAT_SESSION_EXPIRED" },
          { status: 401 },
        );
      }

      context = verifyMpChatMiniAppInitData({
        initData: body.initData,
        botToken,
        botUsername: normalizeBotUsername(botUsername),
        startParam: body.startParam,
        maxAgeSeconds: numberFromEnv(
          process.env.MPCHAT_INITDATA_MAX_AGE,
          DEFAULT_INIT_DATA_MAX_AGE_SECONDS,
        ),
      });
      shouldRefreshSessionCookie = true;
    }

    const token = signMpChatPrivyJwt(context);
    const response = NextResponse.json({ token });

    if (shouldRefreshSessionCookie) {
      response.cookies.set(cookieName, signMpChatSession(context, sessionSecret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: getMpChatSessionMaxAge(),
        path: "/",
      });
    }

    console.info("mpchat miniapp privy jwt issued", {
      mpUserId: context.mpUserId,
      mpChatId: context.mpChatId,
      botUsername: context.botUsername,
      fromSession: !shouldRefreshSessionCookie,
    });

    return response;
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "INIT_DATA_INVALID";
    if (code === "MPCHAT_LOGIN_NOT_CONFIGURED") {
      return NextResponse.json({ error: code }, { status: 503 });
    }
    return NextResponse.json({ error: "INIT_DATA_INVALID" }, { status: 401 });
  }
}

function normalizeBotUsername(value: string): string {
  return value.trim().replace(/^@/, "");
}
