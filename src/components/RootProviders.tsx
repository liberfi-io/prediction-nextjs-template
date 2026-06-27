"use client";

/**
 * Shared providers mounted at the app root for every route tree.
 *
 * Holds only the dependency-free, auth-agnostic providers — the React Query
 * client and the i18n LocaleProvider — so that the `/` launch splash and the
 * `(recovery)` route group can use react-query / translations WITHOUT pulling
 * in Privy or the custom-JWT auto-login. The authenticated app shell
 * (AuthProviders, Telegram/MPChat auto-login, predict services, page chrome)
 * lives in `(main)/layout.tsx` via {@link AppLayout}; the recovery flow gets its
 * own isolated Privy provider via `(recovery)/layout.tsx`.
 */

import { PropsWithChildren, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  LocaleCode,
  LocaleProvider,
  i18n,
  defaultNS,
} from "@liberfi.io/i18n";
import { getQueryClient } from "../libs/queryClient";
import { SUPPORTED_LANG_CODES, toSupportedLang } from "../i18n/locales";
import { i18nResources } from "../i18n/resources";
import { ResolvedLocaleProvider } from "../i18n/ResolvedLocaleProvider";

for (const [code, bundle] of Object.entries(i18nResources)) {
  i18n.addResourceBundle(code, defaultNS, bundle, true, true);
}

export function RootProviders({
  children,
  locale,
}: PropsWithChildren<{ locale: LocaleCode }>) {
  const localeApplied = useRef(false);
  if (!localeApplied.current) {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
    localeApplied.current = true;
  }

  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ResolvedLocaleProvider locale={locale}>
        <LocaleProvider
          locale={locale}
          supportedLanguages={SUPPORTED_LANG_CODES}
          convertDetectedLanguage={toSupportedLang}
          resources={i18nResources}
        >
          {children}
        </LocaleProvider>
      </ResolvedLocaleProvider>
    </QueryClientProvider>
  );
}
