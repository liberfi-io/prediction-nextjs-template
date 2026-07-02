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

function parseJsonParam<T extends object>(value: string | null): T | null {
  if (!value) return null;

  try {
    return asObject<T>(JSON.parse(value));
  } catch {
    return null;
  }
}

function readInitDataUser(): TelegramWebAppUser | null {
  const initData = readTelegramInitData();
  if (!initData?.trim()) return null;
  return parseJsonParam<TelegramWebAppUser>(
    new URLSearchParams(initData).get("user"),
  );
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

/**
 * Raw Telegram `initData` for the current launch, used to authenticate the
 * mini-app session server-side. Prefer the SDK value
 * (`window.Telegram.WebApp.initData`), but fall back to the launch hash
 * (`#tgWebAppData=...`): `telegram-web-app.js` loads `afterInteractive`, so the
 * SDK may not be ready yet when we sync, while the hash is present from the
 * very first paint.
 */
export function readTelegramInitData(): string | null {
  return asString(getTelegramWebApp()?.initData) ?? readUrlParam("tgWebAppData");
}

export function isLikelyTelegramMiniAppLaunch(): boolean {
  if (readTelegramInitData()) return true;
  return Boolean(readUrlStartParam());
}

export function readyTelegramWebApp(): void {
  getTelegramWebApp()?.ready?.();
}

export function expandTelegramWebApp(): void {
  getTelegramWebApp()?.expand?.();
}

export function peekTelegramStartParam(): string | null {
  const webApp = getTelegramWebApp();
  const unsafe = webApp?.initDataUnsafe ?? {};
  return asString(unsafe.start_param) || readUrlStartParam();
}

/**
 * Mini App `start_param` value that routes a launch to the wallet recovery
 * flow instead of the normal app. Legacy Telegram users (whose embedded wallet
 * predates the custom-JWT migration) open the app with this deep link to
 * re-authenticate against their original Privy user and attach the server
 * session signer to that wallet.
 */
export const RECOVERY_START_PARAM = "recovery_tg";

/**
 * True when the current launch should enter the recovery flow. Read from the
 * Mini App `start_param` (with the same URL-hash fallback as the other readers,
 * so it is reliable from first paint before the Telegram SDK finishes loading).
 */
export function isTelegramRecoveryLaunch(): boolean {
  return peekTelegramStartParam() === RECOVERY_START_PARAM;
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
    user: asObject<TelegramWebAppUser>(unsafe.user) ?? readInitDataUser(),
  };
}
