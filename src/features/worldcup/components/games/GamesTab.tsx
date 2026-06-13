"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn, useScreen } from "@liberfi.io/ui";
import { applyLiveStateToMatch } from "../../data/client";
import { useWorldcupLiveUpdates } from "../../data/live";
import { useWorldcupMatches } from "../../data/queries";
import type { WcMatch } from "../../types";
import { useTranslation } from "@liberfi.io/i18n";
import { useOddsFormat } from "../../odds/OddsFormatProvider";
import { OddsFormatSelect } from "../OddsFormatSelect";
import { GamesSkeleton } from "../skeletons";
import { MatchCard } from "./MatchCard";
import { RelatedEvents } from "./RelatedEvents";
import { SportsWidget } from "./SportsWidget";
import { hasLiveVideos } from "./LiveStreamPanel";

type GroupBy = "stage" | "time";

const FINISHED_MATCH_HIDE_DELAY_MS = 3 * 60 * 60 * 1000;
const FALLBACK_MATCH_DURATION_MS = 2 * 60 * 60 * 1000;
const LIVE_VIDEO_AUTOPEN_LEAD_MS = 5 * 60 * 1000;

function nearestScrollContainer(el: HTMLElement): HTMLElement | null {
  let current = el.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    const scrollable =
      /(auto|scroll)/.test(style.overflowY) &&
      current.scrollHeight > current.clientHeight;
    if (scrollable) return current;
    current = current.parentElement;
  }
  return null;
}

function scrollMatchIntoView(matchId: string): void {
  const el = document.getElementById(`match-${matchId}`);
  if (!el) return;
  const container = nearestScrollContainer(el);
  if (!container) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }

  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const delta =
    elRect.top -
    containerRect.top -
    container.clientHeight / 2 +
    elRect.height / 2;
  container.scrollTo({
    top: container.scrollTop + delta,
    behavior: "smooth",
  });
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
        active
          ? "bg-zinc-800 text-[#c7ff2e]"
          : "text-zinc-500 hover:text-zinc-200"
      )}
    >
      {children}
    </button>
  );
}

function finalReferenceMs(match: WcMatch): number {
  const liveEndedAt =
    Date.parse(match.liveState?.updatedAt ?? "") ||
    Date.parse(match.liveState?.observedAt ?? "");
  if (!Number.isNaN(liveEndedAt) && liveEndedAt > 0) return liveEndedAt;
  return match.kickoffMs + FALLBACK_MATCH_DURATION_MS;
}

function isHiddenFromTimeList(match: WcMatch, nowMs: number): boolean {
  if (match.status !== "final") return false;
  return nowMs - finalReferenceMs(match) > FINISHED_MATCH_HIDE_DELAY_MS;
}

function defaultLiveWidgetMatch(matchesInListOrder: WcMatch[], nowMs: number): WcMatch | null {
  const live = matchesInListOrder.find((m) => m.status === "live");
  if (live) return live;

  let next: WcMatch | null = null;
  for (const match of matchesInListOrder) {
    if (match.kickoffMs <= nowMs) continue;
    if (!next || match.kickoffMs < next.kickoffMs) next = match;
  }
  return next;
}

function isWithinLiveVideoAutopenWindow(match: WcMatch, nowMs: number): boolean {
  if (match.status === "live") return true;
  return match.status === "scheduled" && match.kickoffMs >= nowMs && match.kickoffMs - nowMs <= LIVE_VIDEO_AUTOPEN_LEAD_MS;
}

export function GamesTab() {
  const { t, i18n } = useTranslation();
  const { isDesktop } = useScreen();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = i18n.language || "en";
  const [format] = useOddsFormat();
  const [groupBy, setGroupBy] = useState<GroupBy>("time");
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const scrolledTargetRef = useRef<string | null>(null);
  const pendingStageScrollRef = useRef(false);
  const highlightTimeoutRef = useRef<number | null>(null);
  const widgetTouchedRef = useRef(false);

  // SSR-prefetched then polled every 30s; grouping/sorting stays client-side.
  const { data: rawMatches = [], isPending } = useWorldcupMatches();
  const liveStates = useWorldcupLiveUpdates();
  const matches = useMemo(
    () =>
      rawMatches.map((m) => {
        const liveState = liveStates[m.matchId];
        return liveState ? applyLiveStateToMatch(m, liveState) : m;
      }),
    [rawMatches, liveStates]
  );

  const displayMatches = useMemo(
    () =>
      groupBy === "time"
        ? matches.filter((m) => !isHiddenFromTimeList(m, nowMs))
        : matches,
    [matches, groupBy, nowMs]
  );
  const onOpen = useCallback(
    (slug: string) => router.push(`/world-cup/match/${slug}`),
    [router]
  );

  const anchorTarget = useMemo(() => {
    const target = searchParams.get("match") || searchParams.get("anchor");
    return target?.trim() || null;
  }, [searchParams]);

  const flashMatchHighlight = useCallback((matchId: string) => {
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    setHighlightedMatchId(matchId);
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMatchId((current) => (current === matchId ? null : current));
      highlightTimeoutRef.current = null;
    }, 2500);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!anchorTarget || displayMatches.length === 0) return;
    if (scrolledTargetRef.current === anchorTarget) return;
    const match = displayMatches.find((m) => m.matchId === anchorTarget);
    if (!match) return;

    scrolledTargetRef.current = anchorTarget;
    flashMatchHighlight(anchorTarget);
    window.requestAnimationFrame(() => {
      scrollMatchIntoView(anchorTarget);
    });
    const settleTimeout = window.setTimeout(() => {
      scrollMatchIntoView(anchorTarget);
    }, 500);

    return () => {
      window.clearTimeout(settleTimeout);
    };
  }, [anchorTarget, displayMatches, flashMatchHighlight]);

  const sections = useMemo(() => {
    if (groupBy === "time") {
      const byDay = new Map<string, typeof displayMatches>();
      for (const m of [...displayMatches].sort((a, b) => a.kickoffMs - b.kickoffMs)) {
        const key = new Date(m.kickoffMs).toLocaleDateString(
          lang.startsWith("zh") ? "zh-CN" : "en-US",
          { weekday: "short", month: "short", day: "numeric" }
        );
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(m);
      }
      return [...byDay.entries()].map(([title, items]) => ({ title, items }));
    }
    const byGroup = new Map<string, typeof displayMatches>();
    for (const m of displayMatches) {
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
  }, [displayMatches, groupBy, lang, t]);

  const matchesInListOrder = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections],
  );

  const defaultWidgetMatch = useMemo(
    () => defaultLiveWidgetMatch(matchesInListOrder, nowMs),
    [matchesInListOrder, nowMs],
  );

  // Desktop right-rail: match shown in the pinned live widget. The default is
  // selected from the rendered list order: first live match, then nearest future
  // kickoff, with ties preserving the card that appears higher in the list.
  const [liveMatch, setLiveMatch] = useState<WcMatch | null>(null);
  const activeMatch = useMemo(
    () =>
      liveMatch ??
      defaultWidgetMatch ??
      matchesInListOrder[0] ??
      null,
    [liveMatch, defaultWidgetMatch, matchesInListOrder],
  );

  // Mobile (< lg): no pinned widget. The live button toggles an inline widget
  // expanding under the tapped card; only one is open at a time. By default the
  // same match selected for the desktop right-rail is expanded.
  const [openWidgetId, setOpenWidgetId] = useState<string | null>(null);
  const onToggleWidget = useCallback(
    (m: WcMatch) => {
      widgetTouchedRef.current = true;
      setOpenWidgetId((prev) => (prev === m.matchId ? null : m.matchId));
    },
    [],
  );

  useEffect(() => {
    if (widgetTouchedRef.current) return;
    if (!activeMatch || !isWithinLiveVideoAutopenWindow(activeMatch, nowMs)) {
      setOpenWidgetId(null);
      return;
    }

    const shouldOpen = isDesktop
      ? hasLiveVideos(activeMatch.liveVideos)
      : true;
    setOpenWidgetId(shouldOpen ? activeMatch.matchId : null);
  }, [activeMatch, isDesktop, nowMs]);

  useEffect(() => {
    if (!pendingStageScrollRef.current || groupBy !== "stage") return;
    const target = activeMatch?.matchId;
    if (!target || !matchesInListOrder.some((m) => m.matchId === target)) return;

    pendingStageScrollRef.current = false;
    flashMatchHighlight(target);
    window.requestAnimationFrame(() => {
      scrollMatchIntoView(target);
    });

    const settleTimeout = window.setTimeout(() => {
      scrollMatchIntoView(target);
    }, 500);

    return () => {
      window.clearTimeout(settleTimeout);
    };
  }, [activeMatch?.matchId, flashMatchHighlight, groupBy, matchesInListOrder]);

  const handleStageGroupBy = useCallback(() => {
    pendingStageScrollRef.current = true;
    setGroupBy("stage");
  }, []);

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
          <SportsWidget match={activeMatch} className="h-136 shrink-0" />
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
              onClick={handleStageGroupBy}
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
                highlighted={highlightedMatchId === m.matchId}
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
