import { NextResponse } from "next/server";
import { getMpChatPrivyPublicJwk } from "src/libs/server/mpChatPrivyJwt";
import { getTelegramPrivyPublicJwk } from "src/libs/server/telegramPrivyJwt";

export async function GET() {
  const keys: JsonWebKey[] = [];
  const keyIds = new Set<string>();

  pushConfiguredJwk(keys, keyIds, "MPCHAT_PRIVY_JWT_PRIVATE_KEY", getMpChatPrivyPublicJwk);
  pushConfiguredJwk(keys, keyIds, "TELEGRAM_PRIVY_JWT_PRIVATE_KEY", getTelegramPrivyPublicJwk);

  return NextResponse.json({ keys });
}

function pushConfiguredJwk(
  keys: JsonWebKey[],
  keyIds: Set<string>,
  privateKeyEnv: string,
  getJwk: () => JsonWebKey & { kid: string },
) {
  if (!process.env[privateKeyEnv]) return;
  try {
    const jwk = getJwk();
    if (keyIds.has(jwk.kid)) {
      console.error("duplicate privy jwks kid ignored", { kid: jwk.kid });
      return;
    }
    keyIds.add(jwk.kid);
    keys.push(jwk);
  } catch (error: unknown) {
    console.error("privy jwk generation failed", {
      privateKeyEnv,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
