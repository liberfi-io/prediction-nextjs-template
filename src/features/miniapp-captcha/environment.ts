import {
  isLikelyMpChatLaunch,
  readMpChatInitData,
} from "src/features/mpchat-miniapp/launchParams";
import {
  getTelegramWebApp,
  isLikelyTelegramMiniAppLaunch,
  readTelegramInitData,
} from "src/features/telegram-miniapp/launchParams";

export type MiniAppCaptchaPlatform = "telegram" | "mpchat";

export const MINIAPP_CAPTCHA_DETECTION_TIMEOUT_MS = 5000;
export const MINIAPP_CAPTCHA_DETECTION_INTERVAL_MS = 100;

export function detectMiniAppCaptchaPlatform(): MiniAppCaptchaPlatform | null {
  if (getTelegramWebApp() || readTelegramInitData()) {
    return "telegram";
  }

  if (isLikelyMpChatLaunch() || readMpChatInitData()) {
    return "mpchat";
  }

  if (isLikelyTelegramMiniAppLaunch()) {
    return "telegram";
  }

  return null;
}
