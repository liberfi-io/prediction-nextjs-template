/** Returns true when the active i18n language is a Chinese variant. */
export function isZhLang(lang: string): boolean {
  return (lang || "en").toLowerCase().startsWith("zh");
}

/** Compact USD volume, e.g. $1.5M / $12.3K. */
export function formatVolume(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${Math.round(usd)}`;
}

/** Kickoff time + short date, e.g. "7:00 PM · Jun 11". */
export function formatKickoff(ms: number, lang: string): string {
  const d = new Date(ms);
  const intl = lang.startsWith("zh") ? "zh-CN" : "en-US";
  const time = d.toLocaleTimeString(intl, { hour: "numeric", minute: "2-digit" });
  const date = d.toLocaleDateString(intl, { month: "short", day: "numeric" });
  return `${time} · ${date}`;
}

export function formatDayMonth(ms: number, lang: string): string {
  const d = new Date(ms);
  return d.toLocaleDateString(lang.startsWith("zh") ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  });
}
