import { peekTelegramStartParam, readTelegramInitData } from "./launchParams";
import { currentTelegramBotUsername } from "./botContext";

export type TelegramMiniAppBootstrap =
  | {
      mode: "custom_jwt";
      telegramUserId: string;
      subject: string;
      token: string;
    }
  | {
      mode: "unsupported";
      reason?: string;
      telegramUserId?: string;
    };

export async function fetchTelegramMiniAppBootstrap(): Promise<
  TelegramMiniAppBootstrap | undefined
> {
  const initData = readTelegramInitData();
  const botUsername = currentTelegramBotUsername();
  const body = initData?.trim()
    ? {
        initData,
        startParam: peekTelegramStartParam(),
        botUsername,
      }
    : {};

  // Telegram WebViews (WebKit especially) can leave a fetch pending forever
  // during Privy's cold-start burst. Bound it so bootstrap always settles.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("/api/auth/telegram-miniapp/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      signal: controller.signal,
    });
    const result = (await response.json().catch(() => undefined)) as
      | TelegramMiniAppBootstrap
      | undefined;
    if (!response.ok && result?.mode !== "unsupported") return undefined;
    return result;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export async function getTelegramExternalJwt(): Promise<string | undefined> {
  // WebViews can leave a fetch pending forever during Privy's cold-start burst.
  // Bound it so the JWT sync never stalls on a hung request.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("/api/auth/telegram-miniapp/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (!response.ok) {
      console.info("[tg-login] token fetch failed", { status: response.status });
      return undefined;
    }

    const result = (await response.json()) as { mode?: string; token?: string };
    console.info("[tg-login] token fetch ok", {
      mode: result.mode,
      hasToken: Boolean(result.token),
    });
    return result.mode === "custom_jwt" ? result.token : undefined;
  } catch (error: unknown) {
    console.info("[tg-login] token fetch threw", {
      message: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
