export type TelegramStartRoute = "wl" | "wd";

export type TelegramStartOutcome = "y" | "n";

export interface ParsedStartParam {
  version: "v1";
  route: TelegramStartRoute | null;
  target: string | null;
  market: string | null;
  outcome: TelegramStartOutcome | null;
  tgChatId: number | null;
  tgChatType: string | null;
  referral: string | null;
  operatorSegment: string | null;
}

export interface TelegramWebAppUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface TelegramWebAppChat {
  id?: number;
  type?: "group" | "supergroup" | "channel" | string;
  title?: string;
  username?: string;
  photo_url?: string;
}

export interface TelegramMiniAppContext {
  initData: string;
  startParam: string | null;
  chat: TelegramWebAppChat | null;
  chatType: string | null;
  user: TelegramWebAppUser | null;
}
