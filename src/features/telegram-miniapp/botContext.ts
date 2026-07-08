"use client";

const BOT_USERNAME_KEY = "telegram_operator_bot_username";
const MINI_APP_SHORT_NAME_KEY = "telegram_miniapp_short_name";

export function currentTelegramBotUsername(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const fromPath = botUsernameFromPath(window.location.pathname);
  if (fromPath) {
    window.sessionStorage.setItem(BOT_USERNAME_KEY, fromPath);
    return fromPath;
  }
  return undefined;
}

export function currentTelegramMiniAppShortName(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.sessionStorage.getItem(MINI_APP_SHORT_NAME_KEY) || undefined;
}

export function rememberTelegramBotUsername(username: string): void {
  if (typeof window === "undefined") return;
  const clean = username.trim().replace(/^@/, "");
  if (clean) {
    const previous = window.sessionStorage.getItem(BOT_USERNAME_KEY);
    if (previous && previous !== clean) {
      window.sessionStorage.removeItem(MINI_APP_SHORT_NAME_KEY);
    }
    window.sessionStorage.setItem(BOT_USERNAME_KEY, clean);
  }
}

export function rememberTelegramMiniAppShortName(shortName: string): void {
  if (typeof window === "undefined") return;
  const clean = shortName.trim().replace(/^\/+/, "");
  if (clean) {
    window.sessionStorage.setItem(MINI_APP_SHORT_NAME_KEY, clean);
  }
}

function botUsernameFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/tg\/([^/?#]+)/);
  const value = match?.[1] ? decodeURIComponent(match[1]) : "";
  return value.trim() || undefined;
}
