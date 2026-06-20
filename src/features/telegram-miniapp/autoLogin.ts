import { peekTelegramStartParam, readTelegramInitData } from "./launchParams";

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
  const body = initData?.trim()
    ? {
        initData,
        startParam: peekTelegramStartParam(),
      }
    : {};

  try {
    const response = await fetch("/api/auth/telegram-miniapp/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const result = (await response.json().catch(() => undefined)) as
      | TelegramMiniAppBootstrap
      | undefined;
    if (!response.ok && result?.mode !== "unsupported") return undefined;
    return result;
  } catch {
    return undefined;
  }
}

export async function getTelegramExternalJwt(): Promise<string | undefined> {
  try {
    const response = await fetch("/api/auth/telegram-miniapp/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      credentials: "same-origin",
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
  }
}
