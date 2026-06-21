import jwt from "jsonwebtoken";

export type MiniAppCaptchaPlatform = "telegram" | "mpchat";

export interface MiniAppCaptchaSession {
  platform: MiniAppCaptchaPlatform;
  verifiedAt: number;
}

export const MINIAPP_CAPTCHA_COOKIE_DEFAULT_NAME = "miniapp_captcha_verified";
export const MINIAPP_CAPTCHA_COOKIE_DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24;

export function getMiniAppCaptchaCookieName(): string {
  return (
    process.env.MINIAPP_CAPTCHA_COOKIE_NAME ||
    MINIAPP_CAPTCHA_COOKIE_DEFAULT_NAME
  );
}

export function getMiniAppCaptchaCookieMaxAge(): number {
  return numberFromEnv(
    process.env.MINIAPP_CAPTCHA_COOKIE_MAX_AGE,
    MINIAPP_CAPTCHA_COOKIE_DEFAULT_MAX_AGE_SECONDS,
  );
}

export function getMiniAppCaptchaCookieSecret(): string {
  const secret = process.env.MINIAPP_CAPTCHA_COOKIE_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("MINIAPP_CAPTCHA_COOKIE_NOT_CONFIGURED");
  }
  return secret;
}

export function signMiniAppCaptchaSession(
  session: MiniAppCaptchaSession,
  secret = getMiniAppCaptchaCookieSecret(),
): string {
  return jwt.sign(session, secret, {
    algorithm: "HS256",
    expiresIn: getMiniAppCaptchaCookieMaxAge(),
  });
}

export function verifyMiniAppCaptchaSession(
  token: string,
  secret = getMiniAppCaptchaCookieSecret(),
): MiniAppCaptchaSession {
  const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (!payload || typeof payload !== "object") {
    throw new Error("MINIAPP_CAPTCHA_SESSION_EXPIRED");
  }

  const session = payload as Partial<MiniAppCaptchaSession>;
  if (!isMiniAppCaptchaPlatform(session.platform) || !session.verifiedAt) {
    throw new Error("MINIAPP_CAPTCHA_SESSION_EXPIRED");
  }

  return {
    platform: session.platform,
    verifiedAt: session.verifiedAt,
  };
}

export function isMiniAppCaptchaPlatform(
  value: unknown,
): value is MiniAppCaptchaPlatform {
  return value === "telegram" || value === "mpchat";
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
