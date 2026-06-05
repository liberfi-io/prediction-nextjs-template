"use client";

import { useTranslation } from "@liberfi.io/i18n";
import { useEffect, useRef, useState } from "react";
import { cn } from "@liberfi.io/ui";
import { ODDS_FORMATS, type OddsFormat } from "../odds/convert-price";
import { useOddsFormat } from "../odds/OddsFormatProvider";

/** Global odds-format dropdown (8 formats, zero network). */
export function OddsFormatSelect() {
  const { t } = useTranslation();
  const [format, setFormat] = useOddsFormat();
  const oddsLabel = (f: OddsFormat) => t(`extend.worldcup.oddsFormat.${f}`);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-xs font-medium border bg-zinc-800/60 text-zinc-300 border-zinc-700/50 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer tabular-nums"
      >
        <span className="text-zinc-500">{t("extend.worldcup.odds")}</span>
        <span>{oddsLabel(format)}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("text-zinc-500 transition-transform", open && "rotate-180")}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-44 z-50 overflow-hidden p-1"
          style={{
            borderRadius: 12,
            border: "1px solid rgba(39,39,42,1)",
            background: "rgba(24,24,27,1)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
        >
          {ODDS_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFormat(f);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-xs font-medium transition-colors cursor-pointer",
                f === format
                  ? "bg-zinc-800 text-[#c7ff2e]"
                  : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white",
              )}
            >
              {oddsLabel(f)}
              {f === format && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
