import type {
  MpChatMiniAppContext,
  MpChatWebAppChat,
  MpChatWebAppUser,
} from "./types";

interface MpChatWebApp {
  initData?: string;
  initDataUnsafe?: {
    start_param?: unknown;
    startParam?: unknown;
    startapp?: unknown;
    query_id?: unknown;
    queryId?: unknown;
    bot_id?: unknown;
    botId?: unknown;
    nonce?: unknown;
    chat?: unknown;
    chat_type?: unknown;
    chatType?: unknown;
    user?: unknown;
  };
}

declare global {
  interface Window {
    MpChat?: {
      WebApp?: MpChatWebApp;
    };
    JSBridge?: {
      call?: unknown;
    };
    initWebApp?: unknown;
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

function normalizeStartParam(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw.includes("=")) return raw;

  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  return (
    asString(params.get("startapp")) ??
    asString(params.get("start_param")) ??
    asString(params.get("startParam")) ??
    raw
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
  return (
    readUrlParam("mpWebAppStartParam") ||
    readUrlParam("mpChatWebAppStartParam") ||
    readUrlParam("startapp")
  );
}

function readInitDataParam(key: string): string | null {
  const initData = readMpChatInitData();
  if (!initData?.trim()) return null;
  const value = new URLSearchParams(initData).get(key);
  return value?.trim() ? value : null;
}

function readInitDataUser(): MpChatWebAppUser | null {
  return parseJsonParam<MpChatWebAppUser>(readInitDataParam("user"));
}

export function isMpChatMiniAppEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_MPCHAT_MINIAPP === "true";
}

export function getMpChatWebApp(): MpChatWebApp | null {
  if (typeof window === "undefined") return null;
  return window.MpChat?.WebApp ?? null;
}

export function readMpChatInitData(): string | null {
  return (
    asString(getMpChatWebApp()?.initData) ??
    readUrlParam("mpWebAppData") ??
    readUrlParam("mpChatWebAppData")
  );
}

export function peekMpChatStartParam(): string | null {
  const unsafe = getMpChatWebApp()?.initDataUnsafe ?? {};
  return normalizeStartParam(
    asString(unsafe.start_param) ??
      asString(unsafe.startParam) ??
      asString(unsafe.startapp) ??
      readUrlStartParam() ??
      readInitDataParam("start_param") ??
      readInitDataParam("startParam") ??
      readInitDataParam("startapp"),
  );
}

export function isLikelyMpChatLaunch(): boolean {
  if (!isMpChatMiniAppEnabled()) return false;
  if (typeof window === "undefined") return false;
  return Boolean(
    isLikelyMpChatReferrer() ||
      readUrlParam("mpWebAppData") ||
      readUrlParam("mpChatWebAppData") ||
      readUrlParam("mpWebAppStartParam") ||
      readUrlParam("mpChatWebAppStartParam"),
  );
}

function isLikelyMpChatReferrer(): boolean {
  if (typeof document === "undefined" || !document.referrer) return false;

  try {
    const hostname = new URL(document.referrer).hostname;
    return hostname === "mp.net" || hostname.endsWith(".mp.net");
  } catch {
    return false;
  }
}

export function readMpChatMiniAppContext(): MpChatMiniAppContext | null {
  const webApp = getMpChatWebApp();
  const initData = readMpChatInitData();
  const startParam = peekMpChatStartParam();
  if (!webApp && !initData && !startParam) return null;

  const unsafe = webApp?.initDataUnsafe ?? {};
  return {
    initData: initData ?? "",
    startParam,
    queryId: asString(unsafe.query_id) ?? asString(unsafe.queryId) ?? undefined,
    botId: asString(unsafe.bot_id) ?? asString(unsafe.botId) ?? undefined,
    nonce: asString(unsafe.nonce) ?? undefined,
    chat: asObject<MpChatWebAppChat>(unsafe.chat),
    chatType: asString(unsafe.chat_type) ?? asString(unsafe.chatType),
    // initDataUnsafe is display-only convenience data. Never trust it for auth.
    user: asObject<MpChatWebAppUser>(unsafe.user) ?? readInitDataUser(),
  };
}
