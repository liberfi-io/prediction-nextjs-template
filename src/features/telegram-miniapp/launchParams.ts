import type {
  TelegramMiniAppContext,
  TelegramWebAppChat,
  TelegramWebAppUser,
} from "./types";

interface TelegramWebApp {
  initData?: string;
  initDataUnsafe?: {
    start_param?: unknown;
    chat?: unknown;
    chat_type?: unknown;
    user?: unknown;
  };
  ready?: () => void;
  expand?: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

function asObject<T extends object>(value: unknown): T | null {
  return value && typeof value === "object" ? (value as T) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function readyTelegramWebApp(): void {
  getTelegramWebApp()?.ready?.();
}

export function expandTelegramWebApp(): void {
  getTelegramWebApp()?.expand?.();
}

export function readTelegramMiniAppContext(): TelegramMiniAppContext | null {
  const webApp = getTelegramWebApp();
  if (!webApp) return null;

  const unsafe = webApp.initDataUnsafe ?? {};
  return {
    initData: webApp.initData ?? "",
    startParam: asString(unsafe.start_param),
    chat: asObject<TelegramWebAppChat>(unsafe.chat),
    chatType: asString(unsafe.chat_type),
    user: asObject<TelegramWebAppUser>(unsafe.user),
  };
}
