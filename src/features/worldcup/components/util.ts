"use client";

import { useTranslation } from "@liberfi.io/i18n";
import type { WcTeam } from "../types";

export type WcLocale = "zh" | "en";

/** Current UI locale collapsed to zh / en for picking baked bilingual names. */
export function useWcLocale(): WcLocale {
  const { i18n } = useTranslation();
  return (i18n.language || "en").toLowerCase().startsWith("zh") ? "zh" : "en";
}

/**
 * Typed-i18n t() wrapper for worldcup keys. The underlying `useTranslation().t`
 * has a strict key union that doesn't include our `worldcup.*` namespace, so
 * this helper returns a relaxed `(key, options?) => string` function.
 */
export function useWcT() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useTranslation().t as (key: string, options?: Record<string, any>) => string;
}

export function teamName(team: WcTeam, locale: WcLocale): string {
  return locale === "zh" ? team.nameZh : team.name;
}

/** Compact USD volume, e.g. $1.5M / $12.3K. */
export function formatVolume(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${Math.round(usd)}`;
}

/** Kickoff time + short date, e.g. "7:00 PM · Jun 11". */
export function formatKickoff(ms: number, locale: WcLocale): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const date = d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  });
  return `${time} · ${date}`;
}

export function formatDayMonth(ms: number, locale: WcLocale): string {
  const d = new Date(ms);
  return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  });
}
