import { NextRequest, NextResponse } from "next/server";
import { parseStartParam } from "src/features/telegram-miniapp/startParam";
import {
  getTelegramSessionCookieName,
  getTelegramSessionSecret,
  numberFromEnv,
  signTelegramSession,
  type VerifiedTelegramMiniAppContext,
  verifyTelegramMiniAppInitData,
  verifyTelegramSession,
} from "src/libs/server/telegramMiniApp";

interface TelegramMiniAppAuthRequest {
  initData?: string;
  startParam?: string;
}

const DEFAULT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const { initData, startParam } = (await request.json()) as TelegramMiniAppAuthRequest;
    if (!initData?.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing Telegram initData" },
        { status: 400 },
      );
    }

    const context = verifyTelegramMiniAppInitData({
      initData,
      botToken,
      maxAgeSeconds: numberFromEnv(
        process.env.TG_MINIAPP_INITDATA_MAX_AGE,
        DEFAULT_COOKIE_MAX_AGE_SECONDS,
      ),
    });
    const parsedStartParam = startParam?.trim() ? parseStartParam(startParam) : null;
    const tgChatId = context.tgChatId ?? stringifyId(parsedStartParam?.tgChatId);
    const tgChatType =
      context.tgChatType ?? (tgChatId ? parsedStartParam?.tgChatType ?? undefined : undefined);
    const cookieContext = preserveExistingAuthSession(request, botToken, {
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
    const token = signTelegramSession(
      cookieContext,
      getTelegramSessionSecret(botToken),
    );

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
        error: error instanceof Error ? error.message : "Invalid Telegram initData",
      },
      { status: 401 },
    );
  }
}

function stringifyId(value: number | null | undefined): string | undefined {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
}

function preserveExistingAuthSession(
  request: NextRequest,
  botToken: string,
  nextContext: VerifiedTelegramMiniAppContext,
): VerifiedTelegramMiniAppContext {
  const sessionToken = request.cookies.get(getTelegramSessionCookieName())?.value;
  if (!sessionToken) return nextContext;

  try {
    const existingContext = verifyTelegramSession(
      sessionToken,
      getTelegramSessionSecret(botToken),
    );
    if (existingContext.tgUserId !== nextContext.tgUserId) return nextContext;

    return {
      ...nextContext,
      authMode: existingContext.authMode,
      subject: existingContext.subject,
    };
  } catch {
    return nextContext;
  }
}
