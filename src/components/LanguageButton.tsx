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
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-[10px] text-sm font-medium transition-all border bg-zinc-800/60 text-zinc-300 border-zinc-700/50 hover:bg-zinc-800 hover:text-white cursor-pointer"
      >
        <TranslateIcon width={14} height={14} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-36 z-50 overflow-hidden"
          style={{
            borderRadius: 14,
            border: "1px solid rgba(39,39,42,1)",
            background: "rgba(24,24,27,1)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
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
                    "w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-sm transition-all cursor-pointer",
                    selected
                      ? "bg-[#c7ff2e]/[0.08] text-[#c7ff2e]"
                      : "text-zinc-400 hover:text-white hover:bg-[rgba(39,39,42,0.5)]",
                  )}
                >
                  {lang.displayName}
                  {selected && (
                    <svg
                      viewBox="0 0 24 24"
                      width={16}
                      height={16}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="flex-shrink-0"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
