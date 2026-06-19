export interface MpChatWebAppUser {
  id?: number | string;
  firstName?: string;
  first_name?: string;
  username?: string;
  languageCode?: string;
  language_code?: string;
  isPremium?: boolean;
  is_premium?: boolean;
}

export interface MpChatWebAppChat {
  id?: number | string;
  type?: string;
  title?: string;
  username?: string;
}

export interface MpChatMiniAppContext {
  initData: string;
  startParam?: string | null;
  queryId?: string;
  botId?: number | string;
  nonce?: string;
  chat?: MpChatWebAppChat | null;
  chatType?: string | null;
  user?: MpChatWebAppUser | null;
}
