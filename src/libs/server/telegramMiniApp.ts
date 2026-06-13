import { createHmac, timingSafeEqual } from "crypto";

export interface VerifiedTelegramMiniAppContext {
  tgUserId: number;
  tgChatId?: number;
  tgChatType?: string;
}

interface TelegramInitDataUser {
  id?: unknown;
}

interface TelegramInitDataChat {
  id?: unknown;
  type?: unknown;
}

interface VerifyTelegramMiniAppInitDataInput {
  initData: string;
  botToken: string;
  maxAgeSeconds?: number;
}

const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 60 * 60 * 24;

export function verifyTelegramMiniAppInitData({
  initData,
  botToken,
  maxAgeSeconds = DEFAULT_INIT_DATA_MAX_AGE_SECONDS,
}: VerifyTelegramMiniAppInitDataInput): VerifiedTelegramMiniAppContext {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new Error("Missing Telegram initData hash");
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
    throw new Error("Invalid Telegram initData hash");
  }

  assertAuthDate(params.get("auth_date"), maxAgeSeconds);

  const user = parseJsonParam<TelegramInitDataUser>(params.get("user"));
  const tgUserId = asNumber(user?.id);
  if (!tgUserId) {
    throw new Error("Missing Telegram user id");
  }

  const chat = parseJsonParam<TelegramInitDataChat>(params.get("chat"));

  return {
    tgUserId,
    tgChatId: asNumber(chat?.id),
    tgChatType: asString(chat?.type),
  };
}

function assertAuthDate(authDateValue: string | null, maxAgeSeconds: number): void {
  const authDate = Number(authDateValue);
  if (!Number.isFinite(authDate) || authDate <= 0) {
    throw new Error("Missing Telegram auth_date");
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > maxAgeSeconds) {
    throw new Error("Expired Telegram initData");
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

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isTimingSafeEqualHex(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}
