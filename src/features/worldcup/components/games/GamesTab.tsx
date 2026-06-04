"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@liberfi.io/ui";
import { useWorldcupMatches } from "../../data/queries";
import type { WcMatch } from "../../types";
import { useOddsFormat } from "../../odds/OddsFormatProvider";
import { OddsFormatSelect } from "../OddsFormatSelect";
import { GamesSkeleton } from "../skeletons";
import { useWcLocale } from "../util";
import { MatchCard } from "./MatchCard";

type GroupBy = "stage" | "time";

// Third-party TheSports football live widget. The embed URL is a fixed template
// where only `uuid` (the match's `thesportsMatchId`) varies per game.
// Source: .plans/worldcup/future.news/09-thesports-live-widget.md
const WIDGET_PROFILE = "mkyhzl4n10xu5uz";

/**
 * Build the live-widget URL for a given match from its `thesportsMatchId`.
 * Returns null when the match has no mapped widget id (e.g. undrawn knockout
 * fixtures), so the embed can render a placeholder instead.
 * Protocol-relative so it follows the page scheme.
 */
function widgetSrcForMatch(match: WcMatch | null): string | null {
  const uuid = match?.thesportsMatchId;
  if (!uuid) return null;
  return `//widgets-v2.thesports01.com/zh/pro/football?profile=${WIDGET_PROFILE}&uuid=${uuid}`;
}

// Offset from the scroll-container top for the pinned desktop widget, clearing
// the sticky sub-tab row.
const WIDGET_STICKY_TOP = "56px";

function SportsWidget({
  match,
  className,
}: {
  match: WcMatch | null;
  className?: string;
}) {
  const locale = useWcLocale();
  const src = widgetSrcForMatch(match);

  if (!src) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-[12px] border border-zinc-800 bg-zinc-900/40 text-xs text-zinc-500",
          className,
        )}
      >
        {locale === "zh" ? "暂无实况" : "Live unavailable"}
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

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-[8px] text-xs font-medium transition-colors cursor-pointer",
        active ? "bg-zinc-800 text-[#c7ff2e]" : "text-zinc-500 hover:text-zinc-200",
      )}
    >
      {children}
    </button>
  );
}

export function GamesTab() {
  const router = useRouter();
  const locale = useWcLocale();
  const [format] = useOddsFormat();
  const [groupBy, setGroupBy] = useState<GroupBy>("stage");

  // SSR-prefetched then polled every 30s; grouping/sorting stays client-side.
  const { data: matches = [], isPending } = useWorldcupMatches();
  const onOpen = (slug: string) => router.push(`/polymarket/${slug}`);

  // Match currently shown in the live widget (defaults to the first live game,
  // else the earliest scheduled one).
  const [liveMatch, setLiveMatch] = useState<WcMatch | null>(null);
  const activeMatch = useMemo(
    () =>
      liveMatch ??
      matches.find((m) => m.status === "live") ??
      [...matches].sort((a, b) => a.kickoffMs - b.kickoffMs)[0] ??
      null,
    [liveMatch, matches],
  );

  const sections = useMemo(() => {
    if (groupBy === "time") {
      const byDay = new Map<string, typeof matches>();
      for (const m of [...matches].sort((a, b) => a.kickoffMs - b.kickoffMs)) {
        const key = new Date(m.kickoffMs).toLocaleDateString(
          locale === "zh" ? "zh-CN" : "en-US",
          { weekday: "short", month: "short", day: "numeric" },
        );
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(m);
      }
      return [...byDay.entries()].map(([title, items]) => ({ title, items }));
    }
    const byGroup = new Map<string, typeof matches>();
    for (const m of matches) {
      const key = m.groupCode ?? "?";
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(m);
    }
    return [...byGroup.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, items]) => ({
        title: `${locale === "zh" ? "" : "Group "}${code}${locale === "zh" ? " 组" : ""}`,
        items: items.sort((x, y) => x.kickoffMs - y.kickoffMs),
      }));
  }, [matches, groupBy, locale]);

  if (isPending) return <GamesSkeleton />;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
      {/* WIDGET: full-width on top (< lg) via order-first; pinned right column
          (>= lg) via order-last + sticky. Single iframe repositioned by CSS. */}
      <aside className="order-first w-full shrink-0 lg:order-last lg:w-82">
        <div className="lg:sticky" style={{ top: WIDGET_STICKY_TOP }}>
          <SportsWidget match={activeMatch} className="h-[400px]" />
        </div>
      </aside>

      {/* LEFT: toolbar + match list */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-[10px] border border-zinc-800 bg-zinc-900/40 p-0.5">
            <Toggle active={groupBy === "stage"} onClick={() => setGroupBy("stage")}>
              {locale === "zh" ? "按组" : "By group"}
            </Toggle>
            <Toggle active={groupBy === "time"} onClick={() => setGroupBy("time")}>
              {locale === "zh" ? "按日期" : "By date"}
            </Toggle>
          </div>
          <OddsFormatSelect />
        </div>

        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <div className="sticky top-0 z-10 -mx-1 bg-[#0a0a0b]/95 px-1 py-1.5 backdrop-blur">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {section.title}
              </h3>
            </div>
            {section.items.map((m) => (
              <MatchCard
                key={m.matchId}
                match={m}
                format={format}
                activeLive={activeMatch?.matchId === m.matchId}
                onOpen={onOpen}
                onLive={setLiveMatch}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
