"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn, toast } from "@liberfi.io/ui";
import {
  applyLiveStateToMatch,
  applyMarketRealtimeToMatches,
} from "../../data/client";
import { useWorldcupRealtime } from "../../data/live";
import {
  usePrefetchWorldcupMatchEvent,
  useWorldcupMatches,
  useWorldcupMatchEvent,
} from "../../data/queries";
import type { WcMatch } from "../../types";
import { useTranslation } from "@liberfi.io/i18n";
import { useOddsFormat } from "../../odds/OddsFormatProvider";
import { formatLine } from "../../odds/convert-price";
import { OddsFormatSelect } from "../OddsFormatSelect";
import { GamesSkeleton } from "../skeletons";
import { MatchCard } from "./MatchCard";
import { RelatedEvents } from "./RelatedEvents";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import { usePredictWallet, type TradeOutcome, type TradeSide } from "@liberfi.io/ui-predict";
import type { PredictEvent, PredictMarket, ProviderSource } from "@liberfi.io/react-predict";
import {
  FUND_WALLET_MODAL_ID,
  type FundWalletParams,
} from "src/components/FundWalletModal";
import { SETUP_WALLET_MODAL_ID } from "src/components/SetupWalletModal";
import { TradeModal } from "src/components/TradeModal";
import { TradePanel } from "../detail/TradePanel";
import {
  categorizeMarkets,
  findSelection,
  type MarketGroup,
  type TeamHint,
} from "../detail/marketGrouping";
import { resolveMarketDeepLink } from "../detail/deepLink";

type GroupBy = "stage" | "time";

interface GamesTabProps {
  mode?: "all" | "today";
}

interface TradeRequest {
  match: WcMatch;
  marketCode: string;
  outcome: TradeOutcome;
  event?: PredictEvent;
  market?: PredictMarket;
}

const FINISHED_MATCH_HIDE_DELAY_MS = 3 * 60 * 60 * 1000;
const FALLBACK_MATCH_DURATION_MS = 2 * 60 * 60 * 1000;
const LIVE_VIDEO_AUTOPEN_LEAD_MS = 5 * 60 * 1000;
const LIVE_VIDEO_AUTOPEN_LAG_MS = 60 * 60 * 1000;
const FIFA_AVATAR = "/worldcup/fifa.webp";

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

  let nearest: WcMatch | null = null;
  for (const match of matchesInListOrder) {
    if (
      !nearest ||
      Math.abs(match.kickoffMs - nowMs) < Math.abs(nearest.kickoffMs - nowMs)
    ) {
      nearest = match;
    }
  }
  return nearest;
}

function isWithinLiveVideoAutopenWindow(match: WcMatch, nowMs: number): boolean {
  if (match.status === "live") return true;
  return (
    match.status === "scheduled" &&
    nowMs >= match.kickoffMs - LIVE_VIDEO_AUTOPEN_LEAD_MS &&
    nowMs <= match.kickoffMs + LIVE_VIDEO_AUTOPEN_LAG_MS
  );
}

function todayMatchWindow(nowMs: number): { startMs: number; endMs: number } {
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 2);

  return { startMs: start.getTime(), endMs: end.getTime() };
}

function teamHint(match: WcMatch): TeamHint {
  const keys = (...vals: string[]) =>
    new Set(vals.filter(Boolean).map((s) => s.trim().toLowerCase()));
  return {
    homeKeys: keys(match.home.name, match.home.code, match.home.nameZh),
    awayKeys: keys(match.away.name, match.away.code, match.away.nameZh),
  };
}

function tradeMarketForCode(match: WcMatch, marketCode: string): PredictMarket | null {
  const markets = match.tradeMarkets;
  if (!markets) return null;
  switch (marketCode) {
    case "mlh":
      return markets.moneylineHome ?? null;
    case "mld":
      return markets.moneylineDraw ?? null;
    case "mla":
      return markets.moneylineAway ?? null;
    case "sph":
      return markets.spreadHome ?? null;
    case "spa":
      return markets.spreadAway ?? null;
    default:
      return marketCode === "to" || marketCode.startsWith("to")
        ? markets.total ?? null
        : null;
  }
}

function withCleanLabel(market: PredictMarket, label: string): PredictMarket {
  const outcomes = market.outcomes?.length
    ? [{ ...market.outcomes[0], label }, ...market.outcomes.slice(1)]
    : market.outcomes;
  return { ...market, question: label, outcomes };
}

function tradeDisplayLabel(
  group: MarketGroup,
  optionLabel: string,
  t: (key: `extend.${string}`) => unknown,
  selectedLabel?: string,
): string {
  const groupLabel = String(t(`extend.worldcup.detail.markets.type.${group.type_label}`));
  if (group.type === "soccer_exact_score") return optionLabel;
  if (selectedLabel) return `${groupLabel} (${selectedLabel})`;
  if (group.type === "spreads" || group.type === "totals") {
    return `${groupLabel} (${optionLabel})`;
  }
  return group.options.length > 1
    ? `${groupLabel} (${optionLabel})`
    : groupLabel;
}

function selectedTradeLabel(match: WcMatch, marketCode: string, outcome: TradeOutcome): string | undefined {
  if (marketCode === "sph") {
    const team = outcome === "yes" ? match.home : match.away;
    const line = outcome === "yes" ? match.spread.line : -match.spread.line;
    return `${team.code} ${formatLine(line)}`;
  }
  if (marketCode === "spa") {
    const team = outcome === "yes" ? match.away : match.home;
    const line = outcome === "yes" ? -match.spread.line : match.spread.line;
    return `${team.code} ${formatLine(line)}`;
  }
  return undefined;
}

export function GamesTab({ mode = "all" }: GamesTabProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = i18n.language || "en";
  const todayOnly = mode === "today";
  const [format] = useOddsFormat();
  const [groupBy, setGroupBy] = useState<GroupBy>("time");
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [tradeRequest, setTradeRequest] = useState<TradeRequest | null>(null);
  const [tradeSide, setTradeSide] = useState<TradeSide>("buy");
  const scrolledTargetRef = useRef<string | null>(null);
  const pendingStageScrollRef = useRef(false);
  const highlightTimeoutRef = useRef<number | null>(null);
  const widgetTouchedRef = useRef(false);
  const { onOpen: openFundWallet } =
    useAsyncModal<FundWalletParams>(FUND_WALLET_MODAL_ID);
  const { onOpen: openSetupWallet } = useAsyncModal(SETUP_WALLET_MODAL_ID);
  const { polymarketSetupVerified, kalshiKycVerified } = usePredictWallet();

  // SSR-prefetched then polled every 30s; grouping/sorting stays client-side.
  const { data: rawMatches = [], isPending } = useWorldcupMatches();
  const {
    data: tradeEvent,
    isLoading: isTradeEventLoading,
    isError: isTradeEventError,
  } = useWorldcupMatchEvent(
    tradeRequest?.event && tradeRequest.market ? "" : tradeRequest?.match.slug ?? "",
  );
  const prefetchMatchEvent = usePrefetchWorldcupMatchEvent();
  const { liveStates, marketState } = useWorldcupRealtime();
  const matches = useMemo(
    () => {
      const marketMatches = applyMarketRealtimeToMatches(rawMatches, marketState);
      return marketMatches.map((m) => {
        const liveState = liveStates[m.matchId];
        return liveState ? applyLiveStateToMatch(m, liveState) : m;
      });
    },
    [rawMatches, liveStates, marketState]
  );

  const effectiveGroupBy = todayOnly ? "time" : groupBy;

  const displayMatches = useMemo(() => {
    const windowedMatches = todayOnly
      ? (() => {
          const { startMs, endMs } = todayMatchWindow(nowMs);
          return matches.filter((m) => m.kickoffMs >= startMs && m.kickoffMs < endMs);
        })()
      : matches;

    return effectiveGroupBy === "time"
      ? windowedMatches.filter((m) => !isHiddenFromTimeList(m, nowMs))
      : windowedMatches;
  }, [effectiveGroupBy, matches, nowMs, todayOnly]);
  const onOpen = useCallback(
    (slug: string) => router.push(`/event/${slug}`),
    [router]
  );
  const handleMarketPick = useCallback(
    (match: WcMatch, marketCode: string, outcome: TradeOutcome) => {
      const market = tradeMarketForCode(match, marketCode);
      const event = match.tradeEvent;
      setTradeRequest({
        match,
        marketCode,
        outcome,
        event,
        market: event && market ? market : undefined,
      });
      setTradeSide("buy");
    },
    [],
  );

  const tradeSelection = useMemo(() => {
    if (tradeRequest?.event && tradeRequest.market) {
      const cats = categorizeMarkets(
        tradeRequest.event.markets ?? [],
        teamHint(tradeRequest.match),
      );
      const selection = findSelection(cats, tradeRequest.market.slug);
      const market = selection
        ? withCleanLabel(
            tradeRequest.market,
            tradeDisplayLabel(
              selection.group,
              selection.option.label,
              t,
              selectedTradeLabel(
                tradeRequest.match,
                tradeRequest.marketCode,
                tradeRequest.outcome,
              ),
            ),
          )
        : tradeRequest.market;
      return {
        event: { ...tradeRequest.event, image_url: FIFA_AVATAR },
        market,
      };
    }
    if (!tradeRequest || !tradeEvent) return null;
    const cats = categorizeMarkets(tradeEvent.markets ?? [], teamHint(tradeRequest.match));
    const resolved = resolveMarketDeepLink({
      cats,
      match: tradeRequest.match,
      marketCode: tradeRequest.marketCode,
      outcomeCode: tradeRequest.outcome,
    });
    if (!resolved) return null;
    const selection = findSelection(cats, resolved.marketSlug);
    if (!selection) return null;
    return {
      event: { ...tradeEvent, image_url: FIFA_AVATAR },
      market: withCleanLabel(
        selection.option.market,
        tradeDisplayLabel(
          selection.group,
          selection.option.label,
          t,
          selectedTradeLabel(
            tradeRequest.match,
            tradeRequest.marketCode,
            tradeRequest.outcome,
          ),
        ),
      ),
    };
  }, [t, tradeEvent, tradeRequest]);

  const handleInsufficientBalance = useCallback(
    (src: ProviderSource) => {
      if (src === "polymarket" && !polymarketSetupVerified) {
        void openSetupWallet();
        return;
      }

      const needsPrerequisite = src === "kalshi" && !kalshiKycVerified;
      if (!needsPrerequisite) {
        toast.error(t("predict.trade.insufficientBalance"));
      }
      openFundWallet({
        params: {
          initialScreen: "deposit",
          initialWallet: src === "polymarket" ? "evm" : "solana",
        },
      });
    },
    [
      kalshiKycVerified,
      openFundWallet,
      openSetupWallet,
      polymarketSetupVerified,
      t,
    ],
  );

  const handleSetupRequired = useCallback(() => {
    void openSetupWallet();
  }, [openSetupWallet]);

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
    if (effectiveGroupBy === "time") {
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
  }, [displayMatches, effectiveGroupBy, lang, t]);

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

    setOpenWidgetId(activeMatch.matchId);
  }, [activeMatch, nowMs]);

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
          {/* Desktop: related events below the widget; header sticks under it. */}
          <RelatedEvents className="hidden lg:flex" />
        </div>
      </aside>

      {/* LEFT: toolbar + match list */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className={cn("flex items-center gap-2", todayOnly ? "justify-end" : "justify-between")}>
          {!todayOnly && (
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
          )}
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
                onMarketPick={handleMarketPick}
                onPrefetch={prefetchMatchEvent}
                onLive={setLiveMatch}
                onToggleWidget={onToggleWidget}
              />
            ))}
          </section>
        ))}

        {/* Mobile: related events below the match list. */}
        <RelatedEvents className="flex lg:hidden" />
      </div>

      <TradeModal
        open={Boolean(tradeRequest)}
        onClose={() => setTradeRequest(null)}
        title={t(`extend.worldcup.detail.trade.${tradeSide}`)}
      >
        {tradeRequest && tradeSelection ? (
          <TradePanel
            event={tradeSelection.event}
            market={tradeSelection.market}
            outcome={tradeRequest.outcome}
            side={tradeSide}
            onSideChange={setTradeSide}
            onOutcomeChange={(outcome) =>
              setTradeRequest((current) =>
                current ? { ...current, outcome } : current,
              )
            }
            onInsufficientBalance={handleInsufficientBalance}
            onSetupRequired={handleSetupRequired}
          />
        ) : (
          <div className="flex min-h-40 items-center justify-center text-sm text-zinc-500">
            {isTradeEventError
              ? t("extend.worldcup.detail.notFound")
              : isTradeEventLoading
                ? t("extend.worldcup.detail.loading")
                : t("extend.worldcup.detail.notFound")}
          </div>
        )}
      </TradeModal>
    </div>
  );
}
