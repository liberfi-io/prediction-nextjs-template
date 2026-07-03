import { NextRequest, NextResponse } from "next/server";
import { parseStartParam } from "src/features/telegram-miniapp/startParam";
import {
  getTelegramSessionCookieName,
  getTelegramSessionMaxAge,
  getTelegramSessionSecret,
  numberFromEnv,
  signTelegramSession,
  verifyTelegramMiniAppInitData,
  verifyTelegramMiniAppViaBotService,
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
  botUsername?: string;
}

const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 60 * 60 * 24;

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!process.env.TELEGRAM_PRIVY_JWT_PRIVATE_KEY) {
    return NextResponse.json(
      { mode: "unsupported", reason: "TELEGRAM_LOGIN_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as TelegramMiniAppBootstrapRequest;
    const context = await resolveTelegramContext(request, body, botToken);
    const subject = buildTelegramPrivySubject(context);

    // Telegram Mini App login is custom-JWT only. The stable `custom_auth`
    // subject means Privy idempotently logs the same user in (created on first
    // login, reused on return), so no Privy server lookup is needed here.
    const sessionContext = { ...context, authMode: "custom_jwt" as const, subject };
    const response = NextResponse.json({
      mode: "custom_jwt",
      telegramUserId: context.tgUserId,
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

async function resolveTelegramContext(
  request: NextRequest,
  body: TelegramMiniAppBootstrapRequest,
  botToken?: string,
): Promise<VerifiedTelegramMiniAppContext> {
  if (body.initData?.trim() && body.botUsername?.trim()) {
    return verifyTelegramMiniAppViaBotService({
      botUsername: body.botUsername,
      initData: body.initData,
      startParam: body.startParam,
    });
  }
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
  if (!botToken) {
    throw new Error("TELEGRAM_LOGIN_NOT_CONFIGURED");
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
  const effectiveStartParam = body.startParam?.trim() || context.startParam;
  const parsedStartParam = effectiveStartParam ? parseStartParam(effectiveStartParam) : null;
  const tgChatId = context.tgChatId ?? stringifyId(parsedStartParam?.tgChatId);
  const tgChatType =
    context.tgChatType ?? (tgChatId ? parsedStartParam?.tgChatType ?? undefined : undefined);
  return {
    ...context,
    ...(tgChatId ? { tgChatId } : {}),
    ...(tgChatType ? { tgChatType } : {}),
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
  botToken?: string,
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
