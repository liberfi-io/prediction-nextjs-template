"use client";

const BOT_USERNAME_KEY = "telegram_operator_bot_username";

export function currentTelegramBotUsername(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const fromPath = botUsernameFromPath(window.location.pathname);
  if (fromPath) {
    window.sessionStorage.setItem(BOT_USERNAME_KEY, fromPath);
    return fromPath;
  }
  return window.sessionStorage.getItem(BOT_USERNAME_KEY) || undefined;
}

export function rememberTelegramBotUsername(username: string): void {
  if (typeof window === "undefined") return;
  const clean = username.trim().replace(/^@/, "");
  if (clean) {
    window.sessionStorage.setItem(BOT_USERNAME_KEY, clean);
  }
}

function botUsernameFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/tg\/([^/?#]+)/);
  const value = match?.[1] ? decodeURIComponent(match[1]) : "";
  return value.trim() || undefined;
}
