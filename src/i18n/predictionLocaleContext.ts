"use server";

import { i18nCookieKey } from "@liberfi.io/i18n/server";
import { cookies, headers } from "next/headers";
import { detectLanguage } from "./detectLanguage";
import { mapToApiLang } from "./locales";

export async function getPredictionLocaleContext() {
  const [lang, cookieStore, headerStore] = await Promise.all([
    detectLanguage(),
    cookies(),
    headers(),
  ]);
  const cookieLang = cookieStore.get(i18nCookieKey)?.value;
  const acceptLanguage = headerStore.get("accept-language");
  const requestHeaders: HeadersInit = {};

  if (cookieLang) {
    requestHeaders.Cookie = `${i18nCookieKey}=${encodeURIComponent(cookieLang)}`;
  }
  if (acceptLanguage) {
    requestHeaders["Accept-Language"] = acceptLanguage;
  }

  return {
    lang: mapToApiLang(lang),
    requestHeaders,
  };
}
