"use server";

import { defaultLng, defaultNS, i18next, LocaleCode } from "@liberfi.io/i18n/server";
import { SUPPORTED_LANG_CODES } from "./locales";
import { i18nResources } from "./resources";

let initialized = false;

export async function initServerI18n(lang: LocaleCode) {
  if (initialized) return i18next;

  const resources = Object.fromEntries(
    SUPPORTED_LANG_CODES.flatMap((code) => {
      const bundle = i18nResources[code];
      return bundle ? [[code, { [defaultNS]: bundle }]] : [];
    }),
  );

  await i18next.init({
    lng: lang,
    fallbackLng: defaultLng,
    supportedLngs: SUPPORTED_LANG_CODES,
    ns: [defaultNS],
    defaultNS,
    initImmediate: false,
    resources,
  });

  initialized = true;
  return i18next;
}
