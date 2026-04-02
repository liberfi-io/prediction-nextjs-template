"use server";

import { defaultLng, defaultNS, i18next, LocaleCode, LocaleEnum } from "@liberfi.io/i18n/server";
import en from "../locales/en.json";
import zh from "../locales/zh.json";
import en2 from "@liberfi.io/i18n/locales/en.json";
import zh2 from "@liberfi.io/i18n/locales/zh.json";

let initialized = false;

export async function initServerI18n(lang: LocaleCode) {
  if (initialized) return i18next;

  await i18next.init({
    lng: lang,
    fallbackLng: defaultLng,
    supportedLngs: [LocaleEnum.en, LocaleEnum.zh],
    ns: [defaultNS],
    defaultNS,
    initImmediate: false,
    resources: {
      [LocaleEnum.en]: {
        [defaultNS]: { ...en, ...en2 },
      },
      [LocaleEnum.zh]: {
        [defaultNS]: { ...zh, ...zh2 },
      },
    },
  });

  initialized = true;
  return i18next;
}
