import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { parseStartParam } from "src/features/telegram-miniapp/startParam";
import { verifyTelegramMiniAppInitData } from "src/libs/server/telegramMiniApp";

interface TelegramMiniAppAuthRequest {
  initData?: string;
  startParam?: string;
}

const DEFAULT_COOKIE_NAME = "tg_miniapp_context";
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
    const tgChatId = context.tgChatId ?? parsedStartParam?.tgChatId;
    const cookieContext = {
      ...context,
      ...(tgChatId ? { tgChatId } : {}),
      ...(parsedStartParam?.tgChatId && !context.tgChatId
        ? { tgChatSource: "start_param" }
        : context.tgChatId
          ? { tgChatSource: "init_data" }
          : {}),
    };

    const cookieMaxAge = numberFromEnv(
      process.env.TG_MINIAPP_COOKIE_MAX_AGE,
      DEFAULT_COOKIE_MAX_AGE_SECONDS,
    );
    const token = jwt.sign(
      cookieContext,
      process.env.TG_MINIAPP_COOKIE_SECRET || process.env.JWT_SECRET || botToken,
      {
        expiresIn: cookieMaxAge,
        algorithm: "HS256",
      },
    );

    const response = NextResponse.json({ success: true });
    response.cookies.set(process.env.TG_MINIAPP_COOKIE_NAME || DEFAULT_COOKIE_NAME, token, {
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

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
