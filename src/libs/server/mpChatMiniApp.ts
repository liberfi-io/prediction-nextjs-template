import { createHmac, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";

export interface VerifiedMpChatMiniAppContext {
  mpUserId: string;
  mpChatId?: string;
  mpChatType?: string;
  startParam?: string;
  queryId?: string;
  botId?: string;
  botUsername: string;
  nonce?: string;
  username?: string;
  firstName?: string;
  languageCode?: string;
}

interface MpChatInitDataUser {
  id?: unknown;
  first_name?: unknown;
  username?: unknown;
  language_code?: unknown;
}

interface MpChatInitDataChat {
  id?: unknown;
  type?: unknown;
}

interface VerifyMpChatMiniAppInitDataInput {
  initData: string;
  botToken: string;
  maxAgeSeconds?: number;
  botUsername: string;
  startParam?: string;
}

const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 300;

export const MPCHAT_SESSION_COOKIE_DEFAULT_NAME = "mp_miniapp_context";
export const MPCHAT_SESSION_COOKIE_DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function verifyMpChatMiniAppInitData({
  initData,
  botToken,
  maxAgeSeconds = DEFAULT_INIT_DATA_MAX_AGE_SECONDS,
  botUsername,
  startParam,
}: VerifyMpChatMiniAppInitDataInput): VerifiedMpChatMiniAppContext {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new Error("INIT_DATA_INVALID");
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!isTimingSafeEqualHex(expectedHash, hash)) {
    throw new Error("INIT_DATA_INVALID");
  }

  assertAuthDate(params.get("auth_date"), maxAgeSeconds);

  const userRaw = params.get("user");
  const user = parseJsonParam<MpChatInitDataUser>(userRaw);
  const mpUserId = extractJsonFieldString(userRaw, "id") ?? asIdString(user?.id);
  if (!mpUserId) {
    throw new Error("INIT_DATA_INVALID");
  }

  const chatRaw = params.get("chat");
  const chat = parseJsonParam<MpChatInitDataChat>(chatRaw);

  return {
    mpUserId,
    botUsername,
    mpChatId: extractJsonFieldString(chatRaw, "id") ?? asIdString(chat?.id),
    mpChatType: asString(chat?.type) ?? asStringParam(params, "chat_type"),
    startParam: startParam?.trim() || asStringParam(params, "start_param"),
    queryId: asStringParam(params, "query_id"),
    botId: asStringParam(params, "bot_id"),
    nonce: asStringParam(params, "nonce"),
    username: asString(user?.username),
    firstName: asString(user?.first_name),
    languageCode: asString(user?.language_code),
  };
}

export function getMpChatSessionCookieName(): string {
  return process.env.MPCHAT_MINIAPP_COOKIE_NAME || MPCHAT_SESSION_COOKIE_DEFAULT_NAME;
}

export function getMpChatSessionMaxAge(): number {
  return numberFromEnv(
    process.env.MPCHAT_MINIAPP_COOKIE_MAX_AGE,
    MPCHAT_SESSION_COOKIE_DEFAULT_MAX_AGE_SECONDS,
  );
}

export function getMpChatSessionSecret(botToken?: string): string {
  const secret =
    process.env.MPCHAT_MINIAPP_COOKIE_SECRET ||
    process.env.JWT_SECRET ||
    botToken ||
    process.env.MPCHAT_BOT_TOKEN;
  if (!secret) {
    throw new Error("MPCHAT_LOGIN_NOT_CONFIGURED");
  }
  return secret;
}

export function signMpChatSession(
  context: VerifiedMpChatMiniAppContext,
  secret = getMpChatSessionSecret(),
): string {
  return jwt.sign(context, secret, {
    expiresIn: getMpChatSessionMaxAge(),
    algorithm: "HS256",
  });
}

export function verifyMpChatSession(
  token: string,
  secret = getMpChatSessionSecret(),
): VerifiedMpChatMiniAppContext {
  const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (!payload || typeof payload !== "object") {
    throw new Error("MPCHAT_SESSION_EXPIRED");
  }

  const context = payload as Partial<VerifiedMpChatMiniAppContext>;
  if (!context.mpUserId || !context.botUsername) {
    throw new Error("MPCHAT_SESSION_EXPIRED");
  }

  return {
    mpUserId: context.mpUserId,
    botUsername: context.botUsername,
    mpChatId: context.mpChatId,
    mpChatType: context.mpChatType,
    startParam: context.startParam,
    queryId: context.queryId,
    botId: context.botId,
    nonce: context.nonce,
    username: context.username,
    firstName: context.firstName,
    languageCode: context.languageCode,
  };
}

export function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function assertAuthDate(authDateValue: string | null, maxAgeSeconds: number): void {
  const authDate = Number(authDateValue);
  if (!Number.isFinite(authDate) || authDate <= 0) {
    throw new Error("INIT_DATA_INVALID");
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > maxAgeSeconds || authDate - now > 60) {
    throw new Error("INIT_DATA_INVALID");
  }
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
