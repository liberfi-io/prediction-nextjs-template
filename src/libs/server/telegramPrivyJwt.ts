import { createPrivateKey, createPublicKey, type JsonWebKey } from "crypto";
import jwt from "jsonwebtoken";
import type { VerifiedTelegramMiniAppContext } from "./telegramMiniApp";

const DEFAULT_PRIVY_JWT_AUDIENCE = "privy";
const DEFAULT_PRIVY_JWT_EXPIRES_IN_SECONDS = 60 * 5;

export function getTelegramPrivyJwtKid(): string {
  const keyId = process.env.TELEGRAM_PRIVY_JWT_KEY_ID;
  if (!keyId?.trim()) {
    throw new Error("TELEGRAM_LOGIN_NOT_CONFIGURED");
  }
  return keyId;
}

export function getTelegramPrivyJwtAlg(): "RS256" | "ES256" {
  return (process.env.TELEGRAM_PRIVY_JWT_ALG as "RS256" | "ES256" | undefined) || "RS256";
}

export function getTelegramPrivyJwtPrivateKey(): string {
  const privateKey = process.env.TELEGRAM_PRIVY_JWT_PRIVATE_KEY;
  if (!privateKey?.trim()) {
    throw new Error("TELEGRAM_LOGIN_NOT_CONFIGURED");
  }
  return privateKey.replace(/\\n/g, "\n");
}

export function getTelegramPrivyBotIdentity(): string {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername?.trim()) {
    throw new Error("TELEGRAM_LOGIN_NOT_CONFIGURED");
  }
  return botUsername.trim();
}

export function buildTelegramPrivySubject(
  context: Pick<
    VerifiedTelegramMiniAppContext,
    "tgUserId" | "providerSubject" | "providerNamespace" | "operatorBotUsername"
  >,
): string {
  if (context.providerSubject) return context.providerSubject;
  if (context.providerNamespace) return `telegram:${context.providerNamespace}:${context.tgUserId}`;
  return `telegram-miniapp:${context.operatorBotUsername || getTelegramPrivyBotIdentity()}:${context.tgUserId}`;
}

export function signTelegramPrivyJwt(context: VerifiedTelegramMiniAppContext): string {
  const issuer = process.env.TELEGRAM_PRIVY_JWT_ISSUER;
  if (!issuer?.trim()) {
    throw new Error("TELEGRAM_LOGIN_NOT_CONFIGURED");
  }

  const subject = context.subject || buildTelegramPrivySubject(context);
  const audience = process.env.TELEGRAM_PRIVY_JWT_AUDIENCE || DEFAULT_PRIVY_JWT_AUDIENCE;
  const tokenPayload = {
    telegram_user_id: context.tgUserId,
    ...(context.providerNamespace ? { provider_namespace: context.providerNamespace } : {}),
    ...(context.operatorBotId ? { operator_bot_id: context.operatorBotId } : {}),
    ...(context.operatorBotUsername ? { operator_bot_username: context.operatorBotUsername } : {}),
    ...(context.username ? { telegram_username: context.username } : {}),
    ...(context.firstName ? { telegram_first_name: context.firstName } : {}),
    ...(context.languageCode ? { telegram_language_code: context.languageCode } : {}),
  };

  return jwt.sign(tokenPayload, getTelegramPrivyJwtPrivateKey(), {
    algorithm: getTelegramPrivyJwtAlg(),
    keyid: getTelegramPrivyJwtKid(),
    issuer,
    audience,
    subject,
    expiresIn: DEFAULT_PRIVY_JWT_EXPIRES_IN_SECONDS,
  });
}

export function getTelegramPrivyPublicJwk(): JsonWebKey & {
  kid: string;
  use: "sig";
  alg: "RS256" | "ES256";
} {
  const privateKey = createPrivateKey(getTelegramPrivyJwtPrivateKey());
  const publicKey = createPublicKey(privateKey);
  const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
  return {
    ...jwk,
    kid: getTelegramPrivyJwtKid(),
    use: "sig",
    alg: getTelegramPrivyJwtAlg(),
  };
}
