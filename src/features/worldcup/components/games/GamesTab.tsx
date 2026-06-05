"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@liberfi.io/ui";
import { useWorldcupMatches } from "../../data/queries";
import type { WcMatch } from "../../types";
import { useTranslation } from "@liberfi.io/i18n";
import { useOddsFormat } from "../../odds/OddsFormatProvider";
import { OddsFormatSelect } from "../OddsFormatSelect";
import { GamesSkeleton } from "../skeletons";
import { MatchCard } from "./MatchCard";
import { RelatedEvents } from "./RelatedEvents";
import { SportsWidget } from "./SportsWidget";

type GroupBy = "stage" | "time";

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
        active
          ? "bg-zinc-800 text-[#c7ff2e]"
          : "text-zinc-500 hover:text-zinc-200"
      )}
    >
      {children}
    </button>
  );
}

export function GamesTab() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "en";
  const [format] = useOddsFormat();
  const [groupBy, setGroupBy] = useState<GroupBy>("stage");

  // SSR-prefetched then polled every 30s; grouping/sorting stays client-side.
  const { data: matches = [], isPending } = useWorldcupMatches();
  const onOpen = (slug: string) => router.push(`/world-cup/match/${slug}`);

  // First in-progress match in list order (the one both layouts default to when
  // multiple games are live at the same time).
  const firstLiveMatch = useMemo(
    () => matches.find((m) => m.status === "live") ?? null,
    [matches]
  );

  // Desktop right-rail: match shown in the pinned live widget (defaults to the
  // first live game, else the earliest scheduled one).
  const [liveMatch, setLiveMatch] = useState<WcMatch | null>(null);
  const activeMatch = useMemo(
    () =>
      liveMatch ??
      firstLiveMatch ??
      [...matches].sort((a, b) => a.kickoffMs - b.kickoffMs)[0] ??
      null,
    [liveMatch, firstLiveMatch, matches]
  );

  // Mobile (< lg): no pinned widget. The live button toggles an inline widget
  // expanding under the tapped card; only one is open at a time. By default the
  // first live match's widget is expanded; nothing when no game is live.
  const [openWidgetId, setOpenWidgetId] = useState<string | null>(null);
  const onToggleWidget = useCallback(
    (m: WcMatch) =>
      setOpenWidgetId((prev) => (prev === m.matchId ? null : m.matchId)),
    []
  );

  // Apply the mobile default once matches are available; later toggles and
  // polling refreshes don't reopen it.
  const defaultedRef = useRef(false);
  useEffect(() => {
    if (defaultedRef.current || matches.length === 0) return;
    defaultedRef.current = true;
    setOpenWidgetId(firstLiveMatch?.matchId ?? null);
  }, [matches.length, firstLiveMatch]);

  const sections = useMemo(() => {
    if (groupBy === "time") {
      const byDay = new Map<string, typeof matches>();
      for (const m of [...matches].sort((a, b) => a.kickoffMs - b.kickoffMs)) {
        const key = new Date(m.kickoffMs).toLocaleDateString(
          lang.startsWith("zh") ? "zh-CN" : "en-US",
          { weekday: "short", month: "short", day: "numeric" }
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
        title: t("extend.worldcup.groupLabel", { code }),
        items: items.sort((x, y) => x.kickoffMs - y.kickoffMs),
      }));
  }, [matches, groupBy, t]);

  if (isPending) return <GamesSkeleton />;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
      {/* WIDGET + related events: desktop-only right column (hidden < lg, where
          the widget instead expands inline under each tapped card). A pinned
          panel that scrolls internally (widget pinned to its top, related header
          just under it) so it scrolls independently of the matches and reaches
          its own bottom. Height is the scroll viewport minus the app header
          (48px) and the pin offset (65px). */}
      <aside className="hidden shrink-0 lg:order-last lg:block lg:w-82">
        <div className="relative lg:sticky lg:top-[65px] lg:flex lg:max-h-[calc(100dvh-113px)] lg:flex-col lg:gap-4 lg:pb-4 lg:overflow-y-auto lg:overflow-x-hidden no-scrollbar">
          <SportsWidget match={activeMatch} className="h-100 shrink-0" />
          {/* Desktop: related events below the widget; header sticks under it. */}
          <RelatedEvents className="hidden lg:flex" />
        </div>
      </aside>

      {/* LEFT: toolbar + match list */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-[10px] border border-zinc-800 bg-zinc-900/40 p-0.5">
            <Toggle
              active={groupBy === "stage"}
              onClick={() => setGroupBy("stage")}
            >
              {t("extend.worldcup.groupBy.stage")}
            </Toggle>
            <Toggle
              active={groupBy === "time"}
              onClick={() => setGroupBy("time")}
            >
              {t("extend.worldcup.groupBy.time")}
            </Toggle>
          </div>
          <OddsFormatSelect />
        </div>

        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <div className="sticky top-[49px] z-10 -mx-1 flex items-center gap-3 bg-[#0a0a0b] px-1 py-1.5">
              <h3 className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {section.title}
              </h3>
              {/* Column headers aligned to the match card's 3 odds columns
                  (each w-[128px], gap-2). Right inset is the card body's px-4
                  (16px) plus the card's 1px right border = 17px. Only shown at
                  md+, where all three columns render; on narrow widths the card
                  collapses to a single moneyline row, so no header is needed. */}
              <div className="hidden shrink-0 items-stretch gap-2 pr-[17px] md:flex">
                {(["moneyline", "spread", "total"] as const).map((col) => (
                  <span
                    key={col}
                    className="w-[128px] text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {t(`extend.worldcup.marketCol.${col}`)}
                  </span>
                ))}
              </div>
            </div>
            {section.items.map((m) => (
              <MatchCard
                key={m.matchId}
                match={m}
                format={format}
                activeLive={activeMatch?.matchId === m.matchId}
                widgetOpen={openWidgetId === m.matchId}
                onOpen={onOpen}
                onLive={setLiveMatch}
                onToggleWidget={onToggleWidget}
              />
            ))}
          </section>
        ))}

        {/* Mobile: related events below the match list. */}
        <RelatedEvents className="flex lg:hidden" />
      </div>
    </div>
  );
}
