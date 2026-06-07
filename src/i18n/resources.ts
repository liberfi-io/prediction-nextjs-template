/**
 * Merged i18n resource bundles for prediction's 12 supported languages
 * (06-i18n.md §M3/M4). Single source shared by both the SSR initializer
 * (initServerI18n) and the client LocaleProvider (AppLayout) so server and
 * client hydrate identical resources.
 *
 * Each language merges the template-local bundle (`src/locales/<code>.json`,
 * the `extend.*` UI chrome + `predict.comments.*` overrides) with the SDK
 * bundle (`@liberfi.io/i18n/locales/<code>.json`, the shared predict / scaffold
 * / common keys). SDK keys win on collision, matching the prior
 * `{ ...template, ...sdk }` merge order.
 */

// `/server` (React-free) so this shared module is safe to import from the
// "use server" SSR initializer as well as the client LocaleProvider.
import { LocaleEnum, type Resources } from "@liberfi.io/i18n/server";

// Template-local bundles (UI chrome + worldcup copy).
import tEn from "../locales/en.json";
import tZhHant from "../locales/zh-Hant.json";
import tJa from "../locales/ja.json";
import tKo from "../locales/ko.json";
import tTh from "../locales/th.json";
import tVi from "../locales/vi.json";
import tFr from "../locales/fr.json";
import tDe from "../locales/de.json";
import tIt from "../locales/it.json";
import tEs from "../locales/es.json";
import tPt from "../locales/pt.json";
import tRu from "../locales/ru.json";

// SDK bundles (shared predict / scaffold / common keys).
import sEn from "@liberfi.io/i18n/locales/en.json";
import sZhHant from "@liberfi.io/i18n/locales/zh-Hant.json";
import sJa from "@liberfi.io/i18n/locales/ja.json";
import sKo from "@liberfi.io/i18n/locales/ko.json";
import sTh from "@liberfi.io/i18n/locales/th.json";
import sVi from "@liberfi.io/i18n/locales/vi.json";
import sFr from "@liberfi.io/i18n/locales/fr.json";
import sDe from "@liberfi.io/i18n/locales/de.json";
import sIt from "@liberfi.io/i18n/locales/it.json";
import sEs from "@liberfi.io/i18n/locales/es.json";
import sPt from "@liberfi.io/i18n/locales/pt.json";
import sRu from "@liberfi.io/i18n/locales/ru.json";

const merge = (template: object, sdk: object) => ({ ...template, ...sdk });

/** Per-language merged bundle, keyed by the SDK locale code. */
export const i18nResources: Resources = {
  [LocaleEnum.en]: merge(tEn, sEn),
  [LocaleEnum.zhHant]: merge(tZhHant, sZhHant),
  [LocaleEnum.ja]: merge(tJa, sJa),
  [LocaleEnum.ko]: merge(tKo, sKo),
  [LocaleEnum.th]: merge(tTh, sTh),
  [LocaleEnum.vi]: merge(tVi, sVi),
  [LocaleEnum.fr]: merge(tFr, sFr),
  [LocaleEnum.de]: merge(tDe, sDe),
  [LocaleEnum.it]: merge(tIt, sIt),
  [LocaleEnum.es]: merge(tEs, sEs),
  [LocaleEnum.pt]: merge(tPt, sPt),
  [LocaleEnum.ru]: merge(tRu, sRu),
} as Resources;
