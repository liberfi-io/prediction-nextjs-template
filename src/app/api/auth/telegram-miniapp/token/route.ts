import { NextRequest, NextResponse } from "next/server";
import {
  getTelegramSessionCookieName,
  getTelegramSessionSecret,
  verifyTelegramSession,
} from "src/libs/server/telegramMiniApp";
import {
  buildTelegramPrivySubject,
  signTelegramPrivyJwt,
} from "src/libs/server/telegramPrivyJwt";

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!process.env.TELEGRAM_PRIVY_JWT_PRIVATE_KEY) {
    return NextResponse.json(
      { mode: "unsupported", reason: "TELEGRAM_LOGIN_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  try {
    const sessionToken = request.cookies.get(getTelegramSessionCookieName())?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "TELEGRAM_SESSION_EXPIRED" }, { status: 401 });
    }

    const context = verifyTelegramSession(
      sessionToken,
      getTelegramSessionSecret(botToken),
    );
    if (context.authMode !== "custom_jwt") {
      return NextResponse.json(
        { mode: "unsupported", reason: "TELEGRAM_SESSION_NOT_CUSTOM_JWT" },
        { status: 401 },
      );
    }

    const subject = context.subject || buildTelegramPrivySubject(context);
    return NextResponse.json({
      mode: "custom_jwt",
      telegramUserId: context.tgUserId,
      subject,
      token: signTelegramPrivyJwt({ ...context, subject }),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "TELEGRAM_SESSION_EXPIRED",
      },
      { status: 401 },
    );
  }
}
