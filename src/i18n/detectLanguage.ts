"use server";

import { i18nCookieKey } from "@liberfi.io/i18n/server";
import { cookies, headers } from "next/headers";
import { toSupportedLang } from "./locales";

/**
 * Resolve the SSR display language, collapsed to prediction's 12 supported
 * languages (06-i18n.md §M3). Priority: i18n cookie (full BCP-47, e.g. zh-Hant)
 * > Accept-Language header > en. Both branches funnel through toSupportedLang so
 * the server picks the same language the client LocaleProvider would (notably
 * any Chinese → zh-Hant), avoiding a first-paint language mismatch.
 */
export async function detectLanguage() {
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get(i18nCookieKey)?.value;
  if (cookieLang) return toSupportedLang(cookieLang);

  const headerStore = await headers();
  const accept = headerStore.get("accept-language");
  return toSupportedLang(accept);
}
