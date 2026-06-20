import { NextRequest, NextResponse } from "next/server";
import { parseStartParam } from "src/features/telegram-miniapp/startParam";
import { privyClient } from "src/libs/privyClient";
import {
  getTelegramSessionCookieName,
  getTelegramSessionMaxAge,
  getTelegramSessionSecret,
  numberFromEnv,
  signTelegramSession,
  verifyTelegramMiniAppInitData,
  verifyTelegramSession,
  type VerifiedTelegramMiniAppContext,
} from "src/libs/server/telegramMiniApp";
import {
  buildTelegramPrivySubject,
  signTelegramPrivyJwt,
} from "src/libs/server/telegramPrivyJwt";

interface TelegramMiniAppBootstrapRequest {
  initData?: string;
  startParam?: string;
}

const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 60 * 60 * 24;

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !process.env.TELEGRAM_PRIVY_JWT_PRIVATE_KEY) {
    return NextResponse.json(
      { mode: "unsupported", reason: "TELEGRAM_LOGIN_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as TelegramMiniAppBootstrapRequest;
    const context = resolveTelegramContext(request, body, botToken);
    const subject = buildTelegramPrivySubject(context);
    const telegramUser = await privyClient.getUserByTelegramUserId(context.tgUserId);
    const customUser = await privyClient.getUserByCustomAuthId(subject);

    if (telegramUser && (!customUser || customUser.id !== telegramUser.id)) {
      // Legacy native Telegram user without a matching custom_auth account.
      // The server SDK cannot append a linked account, so we hand the client a
      // link token: it logs the legacy user in natively, then attaches
      // custom_auth in place via linkWithCustomJwt (opportunistic upgrade).
      // No custom_jwt session cookie here, so token refresh never mints for legacy.
      return NextResponse.json({
        mode: "legacy_native_telegram",
        telegramUserId: context.tgUserId,
        privyUserId: telegramUser.id,
        subject,
        linkToken: signTelegramPrivyJwt({ ...context, subject }),
      });
    }

    const sessionContext = { ...context, authMode: "custom_jwt" as const, subject };
    const response = NextResponse.json({
      mode: "custom_jwt",
      telegramUserId: context.tgUserId,
      ...(customUser ? { privyUserId: customUser.id } : {}),
      subject,
      token: signTelegramPrivyJwt(sessionContext),
    });
    setSessionCookie(response, sessionContext, botToken);
    return response;
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "TELEGRAM_INIT_DATA_INVALID";
    if (code === "TELEGRAM_LOGIN_NOT_CONFIGURED") {
      return NextResponse.json({ mode: "unsupported", reason: code }, { status: 503 });
    }
    return NextResponse.json({ error: code }, { status: 401 });
  }
}

function resolveTelegramContext(
  request: NextRequest,
  body: TelegramMiniAppBootstrapRequest,
  botToken: string,
): VerifiedTelegramMiniAppContext {
  const cookieName = getTelegramSessionCookieName();
  const sessionToken = request.cookies.get(cookieName)?.value;
  if (sessionToken) {
    try {
      return verifyTelegramSession(sessionToken, getTelegramSessionSecret(botToken));
    } catch {
      // Fall through to initData verification.
    }
  }

  if (!body.initData?.trim()) {
    throw new Error("TELEGRAM_SESSION_EXPIRED");
  }

  const context = verifyTelegramMiniAppInitData({
    initData: body.initData,
    botToken,
    startParam: body.startParam,
    maxAgeSeconds: numberFromEnv(
      process.env.TG_MINIAPP_INITDATA_MAX_AGE,
      DEFAULT_INIT_DATA_MAX_AGE_SECONDS,
    ),
  });
  const parsedStartParam = body.startParam?.trim() ? parseStartParam(body.startParam) : null;
  const tgChatId = context.tgChatId ?? stringifyId(parsedStartParam?.tgChatId);
  return {
    ...context,
    ...(tgChatId ? { tgChatId } : {}),
    ...(parsedStartParam?.tgChatId && !context.tgChatId
      ? { tgChatSource: "start_param" as const }
      : context.tgChatId
        ? { tgChatSource: "init_data" as const }
        : {}),
  };
}

function setSessionCookie(
  response: NextResponse,
  context: VerifiedTelegramMiniAppContext,
  botToken: string,
) {
  const maxAge = getTelegramSessionMaxAge();
  response.cookies.set(
    getTelegramSessionCookieName(),
    signTelegramSession(context, getTelegramSessionSecret(botToken)),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    },
  );
}

function stringifyId(value: number | null | undefined): string | undefined {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
}
