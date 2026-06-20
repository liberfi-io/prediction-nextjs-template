import { NextResponse } from "next/server";
import { getMpChatPrivyPublicJwk } from "src/libs/server/mpChatPrivyJwt";
import { getTelegramPrivyPublicJwk } from "src/libs/server/telegramPrivyJwt";

export async function GET() {
  const keys: JsonWebKey[] = [];
  const keyIds = new Map<string, string>();

  pushConfiguredJwk(keys, keyIds, "MPCHAT_PRIVY_JWT_PRIVATE_KEY", getMpChatPrivyPublicJwk);
  pushConfiguredJwk(keys, keyIds, "TELEGRAM_PRIVY_JWT_PRIVATE_KEY", getTelegramPrivyPublicJwk);

  return NextResponse.json({ keys });
}

function pushConfiguredJwk(
  keys: JsonWebKey[],
  keyIds: Map<string, string>,
  privateKeyEnv: string,
  getJwk: () => JsonWebKey & { kid: string },
) {
  if (!process.env[privateKeyEnv]) return;
  try {
    const jwk = getJwk();
    const fingerprint = getPublicJwkFingerprint(jwk);
    const existingFingerprint = keyIds.get(jwk.kid);
    if (existingFingerprint) {
      if (existingFingerprint !== fingerprint) {
        console.error("conflicting privy jwks kid ignored", { kid: jwk.kid, privateKeyEnv });
      }
      return;
    }
    keyIds.set(jwk.kid, fingerprint);
    keys.push(jwk);
  } catch (error: unknown) {
    console.error("privy jwk generation failed", {
      privateKeyEnv,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function getPublicJwkFingerprint(jwk: JsonWebKey): string {
  return JSON.stringify({
    alg: jwk.alg,
    crv: jwk.crv,
    e: jwk.e,
    kty: jwk.kty,
    n: jwk.n,
    use: jwk.use,
    x: jwk.x,
    y: jwk.y,
  });
}
