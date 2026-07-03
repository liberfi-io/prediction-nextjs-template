import { NextRequest, NextResponse } from "next/server";
import { parseStartParam } from "src/features/telegram-miniapp/startParam";
import {
  getTelegramSessionCookieName,
  getTelegramSessionSecret,
  numberFromEnv,
  resolveTelegramBotServiceUsername,
  signTelegramSession,
  type VerifiedTelegramMiniAppContext,
  verifyTelegramMiniAppViaBotService,
  verifyTelegramMiniAppInitData,
  verifyTelegramSession,
} from "src/libs/server/telegramMiniApp";

interface TelegramMiniAppAuthRequest {
  initData?: string;
  startParam?: string;
  botUsername?: string;
}

const DEFAULT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  try {
    const { initData, startParam, botUsername } =
      (await request.json()) as TelegramMiniAppAuthRequest;
    if (!initData?.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing Telegram initData" },
        { status: 400 },
      );
    }

    const serviceBotUsername = resolveTelegramBotServiceUsername({
      botUsername,
      startParam,
    });
    const context = serviceBotUsername
      ? await verifyTelegramMiniAppViaBotService({
          botUsername: serviceBotUsername,
          initData,
          startParam,
        })
      : botToken
        ? verifyTelegramMiniAppInitData({
            initData,
            botToken,
            maxAgeSeconds: numberFromEnv(
              process.env.TG_MINIAPP_INITDATA_MAX_AGE,
              DEFAULT_COOKIE_MAX_AGE_SECONDS,
            ),
          })
        : null;
    if (!context) {
      return new NextResponse(null, { status: 204 });
    }
    const effectiveStartParam = startParam?.trim() || context.startParam;
    const parsedStartParam = effectiveStartParam
      ? parseStartParam(effectiveStartParam)
      : null;
    const tgChatId =
      context.tgChatId ?? stringifyId(parsedStartParam?.tgChatId);
    const tgChatType =
      context.tgChatType ??
      (tgChatId ? (parsedStartParam?.tgChatType ?? undefined) : undefined);
    const sessionSecret = getTelegramSessionSecret(botToken);
    const cookieContext = preserveExistingAuthSession(request, sessionSecret, {
      ...context,
      ...(tgChatId ? { tgChatId } : {}),
      ...(tgChatType ? { tgChatType } : {}),
      ...(parsedStartParam?.tgChatId && !context.tgChatId
        ? { tgChatSource: "start_param" as const }
        : context.tgChatId
          ? { tgChatSource: "init_data" as const }
          : {}),
    });

    const cookieMaxAge = numberFromEnv(
      process.env.TG_MINIAPP_COOKIE_MAX_AGE,
      DEFAULT_COOKIE_MAX_AGE_SECONDS,
    );
    const token = signTelegramSession(cookieContext, sessionSecret);

    const response = NextResponse.json({ success: true });
    response.cookies.set(getTelegramSessionCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: cookieMaxAge,
      path: "/",
    });

    console.info("telegram miniapp initData verified", {
      tgUserId: cookieContext.tgUserId,
      tgChatId: cookieContext.tgChatId,
      tgChatSource: cookieContext.tgChatSource,
    });

    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Invalid Telegram initData",
      },
      { status: 401 },
    );
  }
}

function stringifyId(value: number | null | undefined): string | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : undefined;
}

function preserveExistingAuthSession(
  request: NextRequest,
  sessionSecret: string,
  nextContext: VerifiedTelegramMiniAppContext,
): VerifiedTelegramMiniAppContext {
  const sessionToken = request.cookies.get(
    getTelegramSessionCookieName(),
  )?.value;
  if (!sessionToken) return nextContext;

  try {
    const existingContext = verifyTelegramSession(sessionToken, sessionSecret);
    if (existingContext.tgUserId !== nextContext.tgUserId) return nextContext;
    if (
      existingContext.providerNamespace &&
      nextContext.providerNamespace &&
      existingContext.providerNamespace !== nextContext.providerNamespace
    ) {
      return nextContext;
    }

    return {
      ...nextContext,
      authMode: existingContext.authMode,
      subject: existingContext.subject,
    };
  } catch {
    return nextContext;
  }
}
