"use client";

import { cn } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import type { WcMatch } from "../../types";

// Third-party TheSports football live widget. The embed URL is a fixed template
// where only `uuid` (the match's `thesportsMatchId`) varies per game.
// Source: .plans/worldcup/future.news/09-thesports-live-widget.md
export const WIDGET_PROFILE = "mkyhzl4n10xu5uz";

/**
 * Build the live-widget URL for a given match from its `thesportsMatchId`.
 * Returns null when the match has no mapped widget id (e.g. undrawn knockout
 * fixtures), so the embed can render a placeholder instead.
 * Protocol-relative so it follows the page scheme.
 */
export function widgetSrcForMatch(match: WcMatch | null): string | null {
  const uuid = match?.thesportsMatchId;
  if (!uuid) return null;
  return `//widgets-v2.thesports01.com/zh/pro/football?profile=${WIDGET_PROFILE}&uuid=${uuid}`;
}

/**
 * TheSports football live widget embed. Shared by the World Cup games list
 * (right-rail) and the match detail page (Match Center tab). Renders a
 * placeholder when the match has no mapped widget id.
 */
export function SportsWidget({
  match,
  className,
}: {
  match: WcMatch | null;
  className?: string;
}) {
  const { t: _t } = useTranslation();
  const t = _t as (key: string, options?: Record<string, unknown>) => string;
  const src = widgetSrcForMatch(match);

  if (!src) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-[12px] border border-zinc-800 bg-zinc-900/40 text-xs text-zinc-500",
          className,
        )}
      >
        {t("extend.worldcup.liveUnavailable")}
      </div>
    );
  }

  return (
    <iframe
      // Remount on match switch so the embedded widget reloads cleanly.
      key={match?.thesportsMatchId ?? src}
      title="Football live widget"
      src={src}
      loading="lazy"
      className={cn(
        "w-full overflow-hidden rounded-[12px] border border-zinc-800 bg-zinc-900/40",
        className,
      )}
    />
  );
}
