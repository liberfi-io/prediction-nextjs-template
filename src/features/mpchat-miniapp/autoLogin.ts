import { peekMpChatStartParam, readMpChatInitData } from "./launchParams";

export async function getMpChatExternalJwt(): Promise<string | undefined> {
  // The launch initData can remain present for the WebView lifetime. The
  // backend must prefer the httpOnly session cookie over this stale value.
  const initData = readMpChatInitData();
  const body = initData?.trim()
    ? {
        initData,
        startParam: peekMpChatStartParam(),
      }
    : {};

  // WebViews can leave a fetch pending forever during Privy's cold-start burst.
  // Bound it so the JWT sync never stalls on a hung request.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("/api/auth/mpchat-miniapp/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (!response.ok) {
      return undefined;
    }

    const result = (await response.json()) as { token?: string };
    return result.token;
  } catch {
    // Privy treats thrown getExternalJwt errors as logout triggers.
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
