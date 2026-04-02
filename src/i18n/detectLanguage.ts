"use server";

import { defaultLng, i18nCookieKey, parseI18nLang } from "@liberfi.io/i18n/server";
import { cookies, headers } from "next/headers";

export async function detectLanguage() {
  const cookieStore = await cookies();
  let lang = cookieStore.get(i18nCookieKey)?.value;
  if (lang) return lang;

  const headerStore = await headers();
  lang = headerStore.get("accept-language") ?? undefined;
  if (lang) {
    lang = parseI18nLang(lang);
    return lang;
  }

  return defaultLng;
}
