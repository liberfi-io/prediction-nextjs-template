import { createPrivateKey, createPublicKey, type JsonWebKey } from "crypto";
import jwt from "jsonwebtoken";
import type { VerifiedMpChatMiniAppContext } from "./mpChatMiniApp";

const DEFAULT_PRIVY_JWT_AUDIENCE = "privy";
const DEFAULT_PRIVY_JWT_EXPIRES_IN_SECONDS = 60 * 5;

export function getMpChatPrivyJwtKid(): string {
  const keyId = process.env.MPCHAT_PRIVY_JWT_KEY_ID;
  if (!keyId?.trim()) {
    throw new Error("MPCHAT_LOGIN_NOT_CONFIGURED");
  }
  return keyId;
}

export function getMpChatPrivyJwtAlg(): "RS256" | "ES256" {
  return (process.env.MPCHAT_PRIVY_JWT_ALG as "RS256" | "ES256" | undefined) || "RS256";
}

export function getMpChatPrivyJwtPrivateKey(): string {
  const privateKey = process.env.MPCHAT_PRIVY_JWT_PRIVATE_KEY;
  if (!privateKey?.trim()) {
    throw new Error("MPCHAT_LOGIN_NOT_CONFIGURED");
  }
  return privateKey.replace(/\\n/g, "\n");
}

export function buildMpChatPrivySubject(context: VerifiedMpChatMiniAppContext): string {
  return `mpchat:${context.botUsername}:${context.mpUserId}`;
}

export function signMpChatPrivyJwt(context: VerifiedMpChatMiniAppContext): string {
  const issuer = process.env.MPCHAT_PRIVY_JWT_ISSUER;
  if (!issuer?.trim()) {
    throw new Error("MPCHAT_LOGIN_NOT_CONFIGURED");
  }

  const audience = process.env.MPCHAT_PRIVY_JWT_AUDIENCE || DEFAULT_PRIVY_JWT_AUDIENCE;
  const tokenPayload = {
    mpchat_user_id: context.mpUserId,
    mpchat_bot_username: context.botUsername,
    ...(context.username ? { mpchat_username: context.username } : {}),
    ...(context.languageCode ? { mpchat_language_code: context.languageCode } : {}),
  };

  return jwt.sign(tokenPayload, getMpChatPrivyJwtPrivateKey(), {
    algorithm: getMpChatPrivyJwtAlg(),
    keyid: getMpChatPrivyJwtKid(),
    issuer,
    audience,
    subject: buildMpChatPrivySubject(context),
    expiresIn: DEFAULT_PRIVY_JWT_EXPIRES_IN_SECONDS,
  });
}

export function getMpChatPrivyPublicJwk(): JsonWebKey & {
  kid: string;
  use: "sig";
  alg: "RS256" | "ES256";
} {
  const privateKey = createPrivateKey(getMpChatPrivyJwtPrivateKey());
  const publicKey = createPublicKey(privateKey);
  const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
  return {
    ...jwk,
    kid: getMpChatPrivyJwtKid(),
    use: "sig",
    alg: getMpChatPrivyJwtAlg(),
  };
}
