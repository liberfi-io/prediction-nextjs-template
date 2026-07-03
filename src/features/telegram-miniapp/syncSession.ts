import { peekTelegramStartParam, readTelegramInitData } from "./launchParams";
import { currentTelegramBotUsername } from "./botContext";

export async function syncTelegramMiniAppSession(): Promise<void> {
  const initData = readTelegramInitData();
  if (!initData?.trim()) return;
  const startParam = peekTelegramStartParam();
  const botUsername = currentTelegramBotUsername();

  try {
    await fetch("/api/auth/telegram-miniapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, startParam, botUsername }),
      credentials: "same-origin",
    });
  } catch {
    // Telegram Mini App context sync must never block or fail page navigation.
  }
}
