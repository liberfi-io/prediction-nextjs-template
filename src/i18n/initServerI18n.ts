"use server";

import { defaultLng, defaultNS, i18next, LocaleCode } from "@liberfi.io/i18n/server";
import { SUPPORTED_LANG_CODES } from "./locales";
import { i18nResources } from "./resources";

let initialized = false;

export async function initServerI18n(lang: LocaleCode) {
  if (initialized) return i18next;

  await i18next.init({
    lng: lang,
    fallbackLng: defaultLng,
    supportedLngs: SUPPORTED_LANG_CODES,
    ns: [defaultNS],
    defaultNS,
    initImmediate: false,
    resources: Object.fromEntries(
      Object.entries(i18nResources).map(([code, bundle]) => [
        code,
        { [defaultNS]: bundle },
      ]),
    ),
  });

  initialized = true;
  return i18next;
}
