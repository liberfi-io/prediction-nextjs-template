"use client";

import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { i18n, LocaleCode } from "@liberfi.io/i18n";
import { mapToApiLang, toSupportedLang } from "./locales";

interface ResolvedLocaleContextValue {
  locale: LocaleCode;
  apiLang: string;
}

const ResolvedLocaleContext =
  createContext<ResolvedLocaleContextValue | null>(null);

function resolveLocale(lang?: string | null): LocaleCode {
  return toSupportedLang(lang);
}

export function ResolvedLocaleProvider({
  children,
  locale,
}: PropsWithChildren<{ locale: LocaleCode }>) {
  const [resolvedLocale, setResolvedLocale] = useState<LocaleCode>(() =>
    resolveLocale(locale),
  );

  useEffect(() => {
    setResolvedLocale(resolveLocale(locale));
  }, [locale]);

  useEffect(() => {
    const handleLanguageChanged = (lang: string) => {
      setResolvedLocale(resolveLocale(lang));
    };

    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, []);

  const value = useMemo<ResolvedLocaleContextValue>(
    () => ({
      locale: resolvedLocale,
      apiLang: mapToApiLang(resolvedLocale),
    }),
    [resolvedLocale],
  );

  return (
    <ResolvedLocaleContext.Provider value={value}>
      {children}
    </ResolvedLocaleContext.Provider>
  );
}

export function useResolvedLocale() {
  const ctx = useContext(ResolvedLocaleContext);
  if (!ctx) {
    throw new Error(
      "useResolvedLocale must be used within ResolvedLocaleProvider",
    );
  }
  return ctx;
}

export function useResolvedApiLang() {
  return useResolvedLocale().apiLang;
}
