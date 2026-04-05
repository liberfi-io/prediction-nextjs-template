"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LocaleCode,
  useTranslation,
  useLocale,
  useChangeLocale,
  useLocaleContext,
} from "@liberfi.io/i18n";
import { cn, TranslateIcon } from "@liberfi.io/ui";

export function LanguageButton() {
  const { t } = useTranslation();
  const locale = useLocale();
  const changeLocale = useChangeLocale();
  const { languages } = useLocaleContext();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleSelect = useCallback(
    (code: LocaleCode) => {
      changeLocale(code);
      setIsOpen(false);
    },
    [changeLocale],
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t("extend.header.language")}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border bg-zinc-500/10 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20 hover:text-zinc-300 cursor-pointer"
      >
        <TranslateIcon width={14} height={14} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-36 border border-zinc-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50"
          style={{ backgroundColor: "#18181b" }}
        >
          <div className="p-1">
            {languages.map((lang) => {
              const selected = lang.localCode === locale;
              return (
                <button
                  key={lang.localCode}
                  type="button"
                  onClick={() =>
                    handleSelect(lang.localCode as LocaleCode)
                  }
                  className={cn(
                    "w-full flex items-center px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer",
                    selected
                      ? "bg-violet-500/10 text-violet-300"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50",
                  )}
                >
                  {lang.displayName}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
