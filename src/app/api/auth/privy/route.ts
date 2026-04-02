import { privyClient } from "../../../../libs/privyClient";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

interface PrivyAuthRequest {
  accessToken: string;
  identityToken: string;
}

export async function POST(request: NextRequest) {
  try {
    const { accessToken, identityToken } = (await request.json()) as PrivyAuthRequest;

    const verifiedClaims = await privyClient.verifyAuthToken(accessToken);
    console.info("privy access token verified: ", verifiedClaims.userId);

    const privyUser = await privyClient.getUser({ idToken: identityToken });

    const user = {
      id: privyUser.id,
      email: privyUser.email,
      phone: privyUser.phone,
      createdAt: privyUser.createdAt,
      idp: "privy",
    };

    const token = jwt.sign(user, process.env.JWT_SECRET!, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
      subject: privyUser.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: process.env.JWT_EXPIRES_IN as any,
      algorithm: "HS256",
    });
    const response = NextResponse.json({ accessToken: token });

    response.cookies.set(process.env.JWT_COOKIE_NAME!, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
