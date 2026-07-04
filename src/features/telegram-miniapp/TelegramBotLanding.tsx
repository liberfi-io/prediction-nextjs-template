"use client";

import { useEffect } from "react";
import {
  rememberTelegramBotUsername,
  rememberTelegramMiniAppShortName,
} from "./botContext";

export function TelegramBotLanding({ botUsername }: { botUsername: string }) {
  useEffect(() => {
    rememberTelegramBotUsername(botUsername);
    const params = new URLSearchParams(window.location.search);
    const shortName = params.get("miniappShortName") || params.get("tgMiniAppShortName");
    if (shortName) {
      rememberTelegramMiniAppShortName(shortName);
    }
    const target = `/${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }, [botUsername]);

  return null;
}
