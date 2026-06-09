"use client";

import { cn } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import type { WcMatch } from "../../types";

// Third-party TheSports football live widget. The embed URL is a fixed template
// where only `uuid` (the match's `thesportsMatchId`) varies per game.
// Source: .plans/worldcup/future.news/09-thesports-live-widget.md
export const WIDGET_PROFILE = "7php8zggndfjh097yje6";

/**
 * Map the active UI language to TheSports widget's URL language segment. The
 * embed path takes a base language code, so Chinese variants (e.g. `zh-Hant`)
 * collapse to `zh` and every other language uses its base subtag (e.g. `ja`),
 * defaulting to `en`.
 */
export function widgetLang(lang?: string | null): string {
  const lower = (lang || "en").toLowerCase();
  if (lower.startsWith("zh")) return "zh";
  return lower.split("-")[0] || "en";
}

/**
 * Build the live-widget URL for a given match from its `thesportsMatchId`.
 * The `lang` segment is supplied by the caller (the active UI language) instead
 * of being hard-coded. Returns null when the match has no mapped widget id
 * (e.g. undrawn knockout fixtures), so the embed can render a placeholder
 * instead. Protocol-relative so it follows the page scheme.
 */
export function widgetSrcForMatch(
  match: WcMatch | null,
  lang?: string | null,
): string | null {
  const uuid = match?.thesportsMatchId;
  if (!uuid) return null;
  return `//widgets-v2.thesports01.com/${widgetLang(lang)}/pro/football?profile=${WIDGET_PROFILE}&uuid=${uuid}`;
}

/**
 * TheSports football live widget embed. Shared by the World Cup games list
 * (right-rail) and the match detail page (Match Center tab). Renders a
 * placeholder when the match has no mapped widget id.
 */
export function SportsWidget({
  match,
  className,
  bordered = true,
}: {
  match: WcMatch | null;
  className?: string;
  /** Draw the widget's own border/background. Set false when the host panel
   *  already provides them (e.g. the Match Center tab) to avoid a double edge. */
  bordered?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const src = widgetSrcForMatch(match, i18n.language);
  const chrome = bordered ? "border border-zinc-800 bg-zinc-900/40" : "";

  if (!src) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-[12px] text-xs text-zinc-500",
          chrome,
          className,
        )}
      >
        {t("extend.worldcup.liveUnavailable")}
      </div>
    );
  }

  return (
    <iframe
      // Remount on match or language switch so the embedded widget reloads
      // cleanly (the src encodes both the uuid and the active language).
      key={src}
      title="Football live widget"
      src={src}
      loading="lazy"
      className={cn(
        "w-full overflow-hidden rounded-[12px]",
        chrome,
        className,
      )}
    />
  );
}
