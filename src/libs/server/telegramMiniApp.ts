import { createHmac, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";

export interface VerifiedTelegramMiniAppContext {
  tgUserId: string;
  tgChatId?: string;
  tgChatType?: string;
  tgChatSource?: "init_data" | "start_param";
  startParam?: string;
  queryId?: string;
  username?: string;
  firstName?: string;
  languageCode?: string;
  authDate: number;
  authMode?: TelegramMiniAppAuthMode;
  subject?: string;
}

interface TelegramInitDataUser {
  id?: unknown;
  first_name?: unknown;
  username?: unknown;
  language_code?: unknown;
}

interface TelegramInitDataChat {
  id?: unknown;
  type?: unknown;
}

interface VerifyTelegramMiniAppInitDataInput {
  initData: string;
  botToken: string;
  maxAgeSeconds?: number;
  startParam?: string;
}

const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 60 * 60 * 24;
export const TELEGRAM_SESSION_COOKIE_DEFAULT_NAME = "tg_miniapp_context";
export const TELEGRAM_SESSION_COOKIE_DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24;

export type TelegramMiniAppAuthMode = "custom_jwt";

export function verifyTelegramMiniAppInitData({
  initData,
  botToken,
  maxAgeSeconds = DEFAULT_INIT_DATA_MAX_AGE_SECONDS,
  startParam,
}: VerifyTelegramMiniAppInitDataInput): VerifiedTelegramMiniAppContext {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new Error("TELEGRAM_INIT_DATA_INVALID");
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!isTimingSafeEqualHex(calculatedHash, hash)) {
    throw new Error("TELEGRAM_INIT_DATA_INVALID");
  }

  const authDate = assertAuthDate(params.get("auth_date"), maxAgeSeconds);

  const userRaw = params.get("user");
  const user = parseJsonParam<TelegramInitDataUser>(userRaw);
  const tgUserId = extractJsonFieldString(userRaw, "id") ?? asIdString(user?.id);
  if (!tgUserId) {
    throw new Error("TELEGRAM_INIT_DATA_INVALID");
  }

  const chatRaw = params.get("chat");
  const chat = parseJsonParam<TelegramInitDataChat>(chatRaw);

  return {
    tgUserId,
    tgChatId: extractJsonFieldString(chatRaw, "id") ?? asIdString(chat?.id),
    tgChatType: asString(chat?.type) ?? asStringParam(params, "chat_type"),
    startParam: startParam?.trim() || asStringParam(params, "start_param"),
    queryId: asStringParam(params, "query_id"),
    username: asString(user?.username),
    firstName: asString(user?.first_name),
    languageCode: asString(user?.language_code),
    authDate,
  };
}

export function getTelegramSessionCookieName(): string {
  return process.env.TG_MINIAPP_COOKIE_NAME || TELEGRAM_SESSION_COOKIE_DEFAULT_NAME;
}

export function getTelegramSessionMaxAge(): number {
  return numberFromEnv(
    process.env.TG_MINIAPP_COOKIE_MAX_AGE,
    TELEGRAM_SESSION_COOKIE_DEFAULT_MAX_AGE_SECONDS,
  );
}

export function getTelegramSessionSecret(botToken?: string): string {
  const secret =
    process.env.TG_MINIAPP_COOKIE_SECRET ||
    process.env.JWT_SECRET ||
    botToken ||
    process.env.TELEGRAM_BOT_TOKEN;
  if (!secret) {
    throw new Error("TELEGRAM_LOGIN_NOT_CONFIGURED");
  }
  return secret;
}

export function signTelegramSession(
  context: VerifiedTelegramMiniAppContext,
  secret = getTelegramSessionSecret(),
): string {
  return jwt.sign(context, secret, {
    expiresIn: getTelegramSessionMaxAge(),
    algorithm: "HS256",
  });
}

export function verifyTelegramSession(
  token: string,
  secret = getTelegramSessionSecret(),
): VerifiedTelegramMiniAppContext {
  const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (!payload || typeof payload !== "object") {
    throw new Error("TELEGRAM_SESSION_EXPIRED");
  }

  const context = payload as Partial<VerifiedTelegramMiniAppContext> & {
    tgUserId?: unknown;
    tgChatId?: unknown;
  };
  const tgUserId = asIdString(context.tgUserId);
  if (!tgUserId) {
    throw new Error("TELEGRAM_SESSION_EXPIRED");
  }

  return {
    tgUserId,
    tgChatId: asIdString(context.tgChatId),
    tgChatType: context.tgChatType,
    tgChatSource: context.tgChatSource,
    startParam: context.startParam,
    queryId: context.queryId,
    username: context.username,
    firstName: context.firstName,
    languageCode: context.languageCode,
    authDate: typeof context.authDate === "number" ? context.authDate : 0,
    authMode: context.authMode,
    subject: context.subject,
  };
}

export function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function assertAuthDate(authDateValue: string | null, maxAgeSeconds: number): number {
  const authDate = Number(authDateValue);
  if (!Number.isFinite(authDate) || authDate <= 0) {
    throw new Error("TELEGRAM_INIT_DATA_INVALID");
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > maxAgeSeconds || authDate - now > 60) {
    throw new Error("TELEGRAM_INIT_DATA_EXPIRED");
  }
  return authDate;
}

function parseJsonParam<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function asIdString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asStringParam(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value?.trim() ? value : undefined;
}

function extractJsonFieldString(raw: string | null, key: string): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(new RegExp(`"${key}"\\s*:\\s*"?([^",}]+)"?`));
  return match?.[1]?.trim();
}

function isTimingSafeEqualHex(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}
