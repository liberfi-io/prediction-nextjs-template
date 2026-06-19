import { NextResponse } from "next/server";
import { getMpChatPrivyPublicJwk } from "src/libs/server/mpChatPrivyJwt";

export async function GET() {
  try {
    return NextResponse.json({ keys: [getMpChatPrivyPublicJwk()] });
  } catch {
    return NextResponse.json({ keys: [] }, { status: 503 });
  }
}
