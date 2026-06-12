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

function paramsFromHash(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const hash = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(hash.startsWith("?") ? hash.slice(1) : hash);
}

function readUrlParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  const fromSearch = new URLSearchParams(window.location.search).get(key);
  if (fromSearch?.trim()) return fromSearch;
  const fromHash = paramsFromHash().get(key);
  return fromHash?.trim() ? fromHash : null;
}

function readUrlStartParam(): string | null {
  return readUrlParam("tgWebAppStartParam") || readUrlParam("startapp");
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
  const urlStartParam = readUrlStartParam();
  if (!webApp && !urlStartParam) return null;

  const unsafe = webApp?.initDataUnsafe ?? {};
  return {
    initData: webApp?.initData ?? readUrlParam("tgWebAppData") ?? "",
    startParam: asString(unsafe.start_param) || urlStartParam,
    chat: asObject<TelegramWebAppChat>(unsafe.chat),
    chatType: asString(unsafe.chat_type),
    user: asObject<TelegramWebAppUser>(unsafe.user),
  };
}
