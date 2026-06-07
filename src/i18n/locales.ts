/**
 * Prediction's supported-language registry and the two-step language mapping
 * (06-i18n.md §M3). Two concerns are deliberately separated:
 *
 *   - toSupportedLang(input): decide WHICH display language to show. It runs the
 *     SDK's region→script normalization (zh-TW/zh-HK → zh-Hant, zh/zh-CN →
 *     zh-Hans) and then applies prediction's product policy: this product ships
 *     NO Simplified Chinese, so any Chinese (incl. bare `zh`/`zh-Hans`) collapses
 *     to zh-Hant; anything outside the 12 supported languages collapses to en.
 *   - mapToApiLang(displayLang): turn an already-decided display language (∈ 12)
 *     into the backend `?lang=` value. The backend speaks the same BCP-47 codes,
 *     so this is effectively identity — but it is kept as a distinct seam so the
 *     Chinese collapse logic never leaks into the API layer.
 */

// Import from the React-free `/server` entry: this module is shared by both
// "use server" files (detectLanguage / page prefetch) and client components
// (queries / AppLayout), so it must not pull in the client provider's
// createContext. `/server` re-exports the same enum/codes and parseI18nLang.
import { LocaleCode, LocaleEnum, parseI18nLang } from "@liberfi.io/i18n/server";

export interface SupportedLanguage {
  code: LocaleCode;
  displayName: string;
}

/**
 * The 12 languages prediction ships (06-i18n.md). Order is the language-picker
 * display order. Arabic / RTL is intentionally excluded this phase.
 */
export const PREDICTION_LANGUAGES: SupportedLanguage[] = [
  { code: LocaleEnum.en, displayName: "English" },
  { code: LocaleEnum.zhHant, displayName: "繁體中文" },
  { code: LocaleEnum.ja, displayName: "日本語" },
  { code: LocaleEnum.ko, displayName: "한국어" },
  { code: LocaleEnum.th, displayName: "ไทย" },
  { code: LocaleEnum.vi, displayName: "Tiếng Việt" },
  { code: LocaleEnum.fr, displayName: "Français" },
  { code: LocaleEnum.de, displayName: "Deutsch" },
  { code: LocaleEnum.it, displayName: "Italiano" },
  { code: LocaleEnum.es, displayName: "Español" },
  { code: LocaleEnum.pt, displayName: "Português" },
  { code: LocaleEnum.ru, displayName: "Русский" },
];

/** The 12 supported display-language codes, in picker order. */
export const SUPPORTED_LANG_CODES: LocaleCode[] = PREDICTION_LANGUAGES.map(
  (l) => l.code,
);

const SUPPORTED = new Set<string>(SUPPORTED_LANG_CODES.map(String));

/**
 * Collapse an arbitrary BCP-47-ish input down to one of prediction's 12 display
 * languages. Used by both the SSR detector and the client LocaleProvider's
 * convertDetectedLanguage so the two paths agree.
 */
export function toSupportedLang(input?: string | null): LocaleCode {
  if (!input) return LocaleEnum.en;
  const parsed = String(parseI18nLang(input));
  // Product policy: prediction has no Simplified bundle — all Chinese → Traditional.
  if (parsed.toLowerCase().startsWith("zh")) return LocaleEnum.zhHant;
  if (SUPPORTED.has(parsed)) return parsed as LocaleCode;
  return LocaleEnum.en;
}

/**
 * Map an already-resolved display language (∈ 12) to the backend `?lang=` value.
 * Identity today (codes match); kept separate from the Chinese-collapse logic.
 */
export function mapToApiLang(displayLang: string): string {
  return displayLang;
}
