import { readTelegramInitData } from "./launchParams";

export async function syncTelegramMiniAppSession(): Promise<void> {
  const initData = readTelegramInitData();
  if (!initData?.trim()) return;

  try {
    await fetch("/api/auth/telegram-miniapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
      credentials: "same-origin",
    });
  } catch {
    // Telegram Mini App context sync must never block or fail page navigation.
  }
}
