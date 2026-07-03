"use client";

import { useEffect } from "react";
import { rememberTelegramBotUsername } from "./botContext";

export function TelegramBotLanding({ botUsername }: { botUsername: string }) {
  useEffect(() => {
    rememberTelegramBotUsername(botUsername);
    const target = `/${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }, [botUsername]);

  return null;
}
