"use client";

import { useEffect } from "react";
import { syncTelegramMiniAppSession } from "src/features/telegram-miniapp/syncSession";

export function TelegramMiniAppSessionSync() {
  useEffect(() => {
    void syncTelegramMiniAppSession();
  }, []);

  return null;
}
