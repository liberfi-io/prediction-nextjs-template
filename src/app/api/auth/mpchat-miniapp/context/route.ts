import { NextRequest, NextResponse } from "next/server";
import {
  getMpChatSessionCookieName,
  getMpChatSessionSecret,
  verifyMpChatSession,
} from "src/libs/server/mpChatMiniApp";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(getMpChatSessionCookieName())?.value;
    if (!token) {
      return NextResponse.json({ error: "MPCHAT_SESSION_EXPIRED" }, { status: 401 });
    }

    const context = verifyMpChatSession(token, getMpChatSessionSecret());
    return NextResponse.json({
      mpUserId: context.mpUserId,
      botUsername: context.botUsername,
      mpChatId: context.mpChatId,
      mpChatType: context.mpChatType,
      username: context.username,
      firstName: context.firstName,
      languageCode: context.languageCode,
    });
  } catch {
    return NextResponse.json({ error: "MPCHAT_SESSION_EXPIRED" }, { status: 401 });
  }
}
