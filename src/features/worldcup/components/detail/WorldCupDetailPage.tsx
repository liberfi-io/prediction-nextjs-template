"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import {
  cn,
  toast,
  useScreen,
} from "@liberfi.io/ui";
import type {
  PredictEvent,
  PredictMarket,
  ProviderSource,
} from "@liberfi.io/react-predict";
import {
  EventPriceChart,
  EventMarketDetailWidget,
  usePredictWallet,
  type TradeOutcome,
  type TradeSide,
} from "@liberfi.io/ui-predict";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import {
  FUND_WALLET_MODAL_ID,
  type FundWalletParams,
} from "src/components/FundWalletModal";
import { SETUP_WALLET_MODAL_ID } from "src/components/SetupWalletModal";
import { PortfolioActivitySection } from "src/components/page/PortfolioActivitySection";
import { adaptLiveVideos, applyLiveStateToMatch } from "../../data/client";
import { useWorldcupMatchLive } from "../../data/live";
import { useWorldcupMatchEvent, useWorldcupMatches } from "../../data/queries";
import { hasLiveVideos } from "../games/LiveStreamPanel";
import { DetailHeader, RulesContent, RefContent } from "./DetailHeader";
import { MatchBanner } from "./MatchBanner";
import { MatchCenterTabs } from "./MatchCenterTabs";
import { OddsFormatSelect } from "../OddsFormatSelect";
import { MarketsPanel } from "./MarketsPanel";
import { TradePanel } from "./TradePanel";
import { TradeModal } from "src/components/TradeModal";
import { ENABLE_WORLD_CUP_MATCH_CENTER } from "src/libs/featureFlags";
import {
  predictEventAnalyticsParams,
  predictMarketAnalyticsParams,
  trackMatchDetailView,
  trackOrderClick,
  worldCupMatchAnalyticsParams,
} from "src/lib/analytics";
import { WorldCupDetailSkeleton } from "../skeletons";
import { convertPrice } from "../../odds/convert-price";
import { useOddsFormat } from "../../odds/OddsFormatProvider";
import {
  categorizeMarkets,
  categoryOfGroup,
  allGroups,
  defaultSelection,
  findSelection,
  type MarketOption,
  type TeamHint,
} from "./marketGrouping";
import {
  worldcupMarketOptionDisplayLabel,
  worldcupMarketSelectedSurfaceLabel,
} from "./marketDisplay";
import { normalizeDeepLinkOutcome, resolveMarketDeepLink } from "./deepLink";
import {
  FIFA_AVATAR,
  buildWorldcupTeamHint,
  worldcupMatchTitle,
  type WorldCupTranslate,
} from "../../display";

type TranslatedEvent = PredictEvent & { title_trans?: unknown };
type TranslatedOutcome = PredictMarket["outcomes"][number] & {
  label_trans?: unknown;
  name_trans?: unknown;
};
type TranslatedMarket = PredictMarket & {
  question_trans?: unknown;
  outcomes?: TranslatedOutcome[];
};

function translatedText(base: string | undefined, translated: unknown): string | undefined {
  return typeof translated === "string" && translated.trim() ? translated : base;
}

function withTranslatedEventTitle(
  event: PredictEvent,
  titleOverride?: string,
): PredictEvent {
  if (titleOverride && titleOverride !== event.title) return { ...event, title: titleOverride };
  const translated = event as TranslatedEvent;
  const title = translatedText(event.title, translated.title_trans);
  return title && title !== event.title ? { ...event, title } : event;
}

function localizeKnownLabel(label: string | undefined, hint?: TeamHint): string | undefined {
  if (!label || !hint) return label;
  const normalized = label.trim().toLowerCase();
  if (hint.homeLabel && hint.homeKeys.has(normalized)) return hint.homeLabel;
  if (hint.awayLabel && hint.awayKeys.has(normalized)) return hint.awayLabel;
  if (hint.drawLabel && (normalized === "draw" || normalized === "tie" || normalized === "平")) {
    return hint.drawLabel;
  }
  if (hint.yesLabel && normalized === "yes") return hint.yesLabel;
  if (hint.noLabel && normalized === "no") return hint.noLabel;
  return label;
}

function withTranslatedMarketText(
  market: PredictMarket,
  hint?: TeamHint,
): PredictMarket {
  const translatedMarket = market as TranslatedMarket;
  const question =
    translatedText(market.question, translatedMarket.question_trans) ?? market.question;
  let changed = question !== market.question;
  const outcomes = market.outcomes?.map((outcome) => {
    const translatedOutcome = outcome as TranslatedOutcome;
    const label = translatedText(
      outcome.label,
      translatedOutcome.label_trans ?? translatedOutcome.name_trans,
    );
    const displayLabel = localizeKnownLabel(label, hint);
    if (!displayLabel || displayLabel === outcome.label) return outcome;
    changed = true;
    return { ...outcome, label: displayLabel };
  });

  return changed ? { ...market, question, outcomes } : market;
}

/**
 * Shallow-clone a market with its display label replaced by the already-cleaned
 * Markets-panel option label (e.g. "Draw" instead of Polymarket's verbose
 * "Draw (Mexico vs. South Africa)"). Both the chart legend / selector
 * (`outcomes[0].label ?? question`) and the trade form title
 * (`yesSubTitle` = `outcomes[0].label`) read from these fields. Only the first
 * outcome's label is touched; prices, slug, ids and outcome ordering (which the
 * trade/order-book logic keys off by index) stay intact.
 */
function withCleanLabel(
  market: PredictMarket,
  label: string,
  hint?: TeamHint,
): PredictMarket {
  const displayMarket = withTranslatedMarketText(withSettledOutcomePrices(market), hint);
  const outcomes = displayMarket.outcomes?.length
    ? [{ ...displayMarket.outcomes[0], label }, ...displayMarket.outcomes.slice(1)]
    : displayMarket.outcomes;
  return { ...displayMarket, question: label, outcomes };
}

function withSettledOutcomePrices(market: PredictMarket): PredictMarket {
  if (market.status === "open") return market;

  let changed = false;
  const outcomes = market.outcomes?.length
    ? market.outcomes.map((outcome) => {
        if (typeof outcome.price !== "number" || !Number.isFinite(outcome.price)) {
          return outcome;
        }
        changed = changed || outcome.best_bid !== outcome.price;
        changed = changed || outcome.best_ask !== outcome.price;
        return {
          ...outcome,
          best_bid: outcome.price,
          best_ask: outcome.price,
        };
      })
    : market.outcomes;

  return changed ? { ...market, outcomes } : market;
}

export function WorldCupDetailPage({
  id,
  initialMarket = null,
  initialMarketSlug = null,
  initialOutcome = null,
}: {
  id: string;
  /** Deep-link market short code from the entry URL (`?market=`). */
  initialMarket?: string | null;
  /** Exact market slug from a canonical `/event/{matchSlug}?market=...` URL. */
  initialMarketSlug?: string | null;
  /** Deep-link outcome short code from the entry URL (`?outcome=`). */
  initialOutcome?: string | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const translate = t as WorldCupTranslate;
  const [oddsFormat] = useOddsFormat();
  const { isDesktop } = useScreen();
  const { onOpen: openFundWallet } =
    useAsyncModal<FundWalletParams>(FUND_WALLET_MODAL_ID);
  const { onOpen: openSetupWallet } = useAsyncModal(SETUP_WALLET_MODAL_ID);
  const { polymarketSetupVerified, kalshiKycVerified } = usePredictWallet();

  const { data: rawEvent, isLoading } = useWorldcupMatchEvent(id);
  const { data: matches = [] } = useWorldcupMatches();
  const found = useMemo(
    () => matches.find((m) => m.slug === id),
    [matches, id],
  );
  const liveState = useWorldcupMatchLive(found?.matchId);
  // Force every event avatar on this page — the header and the buy/sell trade
  // panel (which derives its icon from event.image_url) — to the FIFA logo.
  const event = useMemo(
    () => (rawEvent ? { ...rawEvent, image_url: FIFA_AVATAR } : rawEvent),
    [rawEvent],
  );
  const match = useMemo(() => {
    if (!found) return undefined;
    return liveState ? applyLiveStateToMatch(found, liveState) : found;
  }, [found, liveState]);
  const liveVideos = useMemo(() => {
    const eventVideos = adaptLiveVideos(event?.live_videos);
    return eventVideos.length > 0 ? eventVideos : match?.liveVideos;
  }, [event?.live_videos, match?.liveVideos]);
  const showLiveTab = hasLiveVideos(liveVideos, match);
  const mobileTabs = useMemo(
    () => MOBILE_TABS.filter((tab) => tab.key !== "live" || showLiveTab),
    [showLiveTab],
  );

  const hint = useMemo(() => buildWorldcupTeamHint(match, translate), [match, translate]);
  const cats = useMemo(
    () => categorizeMarkets(event?.markets ?? [], hint),
    [event?.markets, hint],
  );

  const [selectedSlug, setSelectedSlug] = useState("");
  const [outcome, setOutcome] = useState<TradeOutcome>("yes");
  const [side, setSide] = useState<TradeSide>("buy");

  // Mobile-only UI state
  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTabKey>("markets");
  const deepLinkAppliedRef = useRef(false);
  const mobileMarketTabOpenedRef = useRef(false);
  const mobileTabsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mobileTab === "live" && !showLiveTab) setMobileTab("markets");
    if (mobileTab === "center" && !ENABLE_WORLD_CUP_MATCH_CENTER) {
      setMobileTab("news");
    }
  }, [mobileTab, showLiveTab]);

  const deepLinkMarket = initialMarket?.trim() || null;
  const exactInitialMarketSlug = initialMarketSlug?.trim() || null;
  const deepLinkOutcome = initialOutcome?.trim() || null;
  const hasCompleteDeepLink = Boolean(
    exactInitialMarketSlug ||
      (deepLinkMarket && normalizeDeepLinkOutcome(deepLinkOutcome)),
  );

  // Resolve the active selection, falling back to the first open market.
  const selection = useMemo(() => {
    const found = selectedSlug ? findSelection(cats, selectedSlug, outcome) : undefined;
    return found ?? defaultSelection(cats);
  }, [cats, outcome, selectedSlug]);

  // Seed the default selection once markets arrive.
  useEffect(() => {
    if (!selectedSlug && selection)
      setSelectedSlug(selection.option.market.slug);
  }, [selectedSlug, selection]);

  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    if (!exactInitialMarketSlug) return;

    const hasOptions = allGroups(cats).some(
      (group) => group.options.length > 0,
    );
    if (!hasOptions) return;

    deepLinkAppliedRef.current = true;
    const resolved = findSelection(cats, exactInitialMarketSlug);
    if (!resolved) return;

    setSelectedSlug(exactInitialMarketSlug);
    setOutcome(normalizeDeepLinkOutcome(deepLinkOutcome) ?? "yes");
    setSide("buy");
  }, [cats, deepLinkOutcome, exactInitialMarketSlug]);

  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    if (!deepLinkMarket) return;
    if (!match) return;

    const hasOptions = allGroups(cats).some(
      (group) => group.options.length > 0,
    );
    if (!hasOptions) return;

    const resolved = resolveMarketDeepLink({
      cats,
      match,
      marketCode: deepLinkMarket,
      outcomeCode: deepLinkOutcome,
    });

    deepLinkAppliedRef.current = true;
    if (!resolved) return;

    setSelectedSlug(resolved.marketSlug);
    setOutcome(resolved.outcome);
    setSide("buy");
  }, [cats, deepLinkMarket, deepLinkOutcome, match]);

  useEffect(() => {
    if (!deepLinkMarket || match || deepLinkAppliedRef.current) return;
    const timeout = window.setTimeout(() => {
      deepLinkAppliedRef.current = true;
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [deepLinkMarket, match]);

  useEffect(() => {
    if (isDesktop) return;
    if (hasCompleteDeepLink) return;
    if (mobileMarketTabOpenedRef.current) return;
    const hasOptions = allGroups(cats).some(
      (group) => group.options.length > 0,
    );
    if (!hasOptions) return;

    mobileMarketTabOpenedRef.current = true;
    setMobileTab("markets");
    window.requestAnimationFrame(() => {
      mobileTabsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [cats, hasCompleteDeepLink, isDesktop]);

  useEffect(() => {
    if (!event) return;
    trackMatchDetailView({
      eventSlug: event.slug,
      source: event.source,
      surface: "world_cup_detail",
      marketSlug: initialMarketSlug ?? undefined,
    });
  }, [event, initialMarketSlug]);

  const handleSelect = useCallback((slug: string, selectedOutcome: TradeOutcome = "yes") => {
    setSelectedSlug(slug);
    setOutcome(selectedOutcome);
    setSide("buy");
  }, []);
  const handleMobileMarketSelect = useCallback(
    (slug: string, selectedOutcome: TradeOutcome = "yes") => {
      handleSelect(slug, selectedOutcome);
      setTradeSheetOpen(true);
    },
    [handleSelect],
  );
  const handleMobileMarketInspect = useCallback(
    (slug: string, selectedOutcome: TradeOutcome = "yes") => {
      handleSelect(slug, selectedOutcome);
    },
    [handleSelect],
  );

  const handleInsufficientBalance = useCallback(
    (src: ProviderSource) => {
      // Polymarket account not yet set up → open the same setup modal as the
      // header balance dropdown, not a deposit/balance flow.
      if (src === "polymarket" && !polymarketSetupVerified) {
        void openSetupWallet();
        return;
      }
      // Kalshi unverified → let the fund modal surface the KYC prompt; suppress
      // the misleading "insufficient balance" toast in that case.
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
      openFundWallet,
      openSetupWallet,
      t,
      polymarketSetupVerified,
      kalshiKycVerified,
    ],
  );

  // Open the shared Polymarket account setup modal (same as the header).
  const handleSetupRequired = useCallback(() => {
    void openSetupWallet();
  }, [openSetupWallet]);
  const oddsFormatter = useCallback(
    (price: number) => convertPrice(price, oddsFormat),
    [oddsFormat],
  );

  if (isLoading && !event) {
    return <WorldCupDetailSkeleton />;
  }

  if (!event) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-sm text-zinc-500">
        {t("extend.worldcup.detail.notFound")}
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 cursor-pointer"
        >
          {t("extend.worldcup.detail.back")}
        </button>
      </div>
    );
  }

  const selectedMarket = selection?.option.market;
  const selectedDisplayMarket = selectedMarket
    ? withTranslatedMarketText(withSettledOutcomePrices(selectedMarket), hint)
    : selectedMarket;
  const displayEvent = withTranslatedEventTitle(event, worldcupMatchTitle(match, hint));
  const selectedGroup = selection?.group;
  const activeCategory = selectedGroup
    ? categoryOfGroup(cats, selectedGroup)
    : "gameLines";

  // Header label, e.g. "Moneyline (Mexico)" / "Totals (0.5)".
  const groupLabel = selectedGroup
    ? t(`extend.worldcup.detail.markets.type.${selectedGroup.type_label}`)
    : "";

  const optionDisplayLabel = (option: MarketOption) =>
    selectedGroup
      ? worldcupMarketOptionDisplayLabel(selectedGroup, option, hint, translate)
      : groupLabel;
  const selectedSurfaceLabel = (option: MarketOption) =>
    selectedGroup
      ? worldcupMarketSelectedSurfaceLabel(selectedGroup, option, hint, translate)
      : groupLabel;

  const selectedLabel =
    selectedGroup && selection
      ? selectedSurfaceLabel(selection.option)
      : displayEvent.title;

  // The chart plots every market in the selected group (e.g. 3 moneyline lines,
  // or the single totals line), reusing EventPriceChart's multi-market support.
  // The chart legend / market selector derive their label from
  // `market.outcomes[0].label ?? market.question`. Override those fields so each
  // line reads like the Markets panel trigger ("Moneyline (Draw)") instead of
  // Polymarket's verbose "Draw (Mexico vs. South Africa)".
  const chartEvent = selectedGroup
    ? {
        ...displayEvent,
        markets: Array.from(
          new Map(selectedGroup.options.map((o) => [o.market.slug, o])).values(),
        ).map((o) => withCleanLabel(o.market, optionDisplayLabel(o), hint)),
      }
    : displayEvent;

  // Trade form title mirrors the selected trigger text ("Buy Yes · Moneyline
  // (Draw)"). Display surfaces use settled prices for closed markets so stale
  // 0.001 tail asks do not render as 1000.00 decimal odds.
  const tradeMarket =
    selectedDisplayMarket && selection
      ? withCleanLabel(selectedDisplayMarket, selectedLabel, hint)
      : selectedDisplayMarket;

  const trackCurrentOrderClick = (params: {
    outcome: TradeOutcome;
    side: TradeSide;
  }) => {
    trackOrderClick({
      ...(match ? worldCupMatchAnalyticsParams(match) : {}),
      ...predictEventAnalyticsParams(displayEvent),
      ...(tradeMarket ? predictMarketAnalyticsParams(tradeMarket) : {}),
      outcome: params.outcome,
      side: params.side,
      surface: "world_cup_detail",
    });
  };

  const handleTradeAction = (
    _market: PredictMarket,
    oc: TradeOutcome,
    sd: TradeSide,
  ) => {
    trackCurrentOrderClick({ outcome: oc, side: sd });
    setOutcome(oc);
    setSide(sd);
  };

  // -------------------------------------------------------------------------
  // Mobile layout: single column with one flat tab row (order book + match
  // center / news / comments / positions / orders / history). Market picks open
  // the trade action sheet directly.
  // -------------------------------------------------------------------------
  if (!isDesktop) {
    return (
      <div className="flex w-full flex-col gap-4">
        <DetailHeader
          event={displayEvent}
          market={selectedDisplayMarket}
          selectedLabel={selectedLabel}
          onBack={() => router.back()}
          showInfoButtons={false}
        />

        {match && <MatchBanner match={match} />}

        <EventPriceChart
          event={chartEvent}
          volume={event.volume ?? undefined}
        />

        {/* Tabbed lower content */}
        <div ref={mobileTabsSectionRef} className="flex flex-col gap-3">
          <div className="flex items-center gap-1 overflow-x-auto rounded-[10px] border border-zinc-800 bg-zinc-900/60 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mobileTabs.map(({ key, labelKey }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMobileTab(key)}
                className={cn(
                  "shrink-0 rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                  mobileTab === key
                    ? "bg-zinc-800 text-[#c7ff2e]"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                {key === "live" ? t("extend.worldcup.live") : t(labelKey)}
              </button>
            ))}
          </div>

          {mobileTab === "markets" && (
            <MarketSwitcherFrame
              title={t("extend.worldcup.detail.markets.title")}
              actionBefore={<OddsFormatSelect />}
              className="h-[70dvh]"
            >
              <MarketsPanel
                cats={cats}
                activeCategory={activeCategory}
                selectedSlug={selectedSlug}
                selectedOutcome={outcome}
                onSelect={handleMobileMarketSelect}
                onInspect={handleMobileMarketInspect}
                renderInlineOrderbook={(slug, inlineOutcome) => {
                  const inlineSelection = findSelection(cats, slug, inlineOutcome);
                  const inlineMarket = inlineSelection?.option.market;
                  if (!inlineSelection || !inlineMarket) return null;

                  const inlineDisplayMarket = withTranslatedMarketText(
                    withSettledOutcomePrices(inlineMarket),
                    hint,
                  );
                  const inlineLabel = worldcupMarketSelectedSurfaceLabel(
                    inlineSelection.group,
                    inlineSelection.option,
                    hint,
                    translate,
                  );
                  const inlineWidgetMarket = withCleanLabel(
                    inlineDisplayMarket,
                    inlineLabel,
                    hint,
                  );

                  return (
                    <div
                      className="flex min-h-[320px] flex-col rounded-[12px] border border-zinc-800 bg-zinc-900/40 p-3"
                      data-market-orderbook
                    >
                      <EventMarketDetailWidget
                        market={inlineWidgetMarket}
                        outcome={inlineOutcome}
                        onTradeAction={(market, oc, sd) => {
                          handleSelect(slug, oc);
                          handleTradeAction(market, oc, sd);
                        }}
                        initialViewMode="table"
                        oddsFormatter={oddsFormatter}
                        className="min-h-0 flex-1"
                      />
                    </div>
                  );
                }}
                className="flex-1 border-0 bg-transparent"
              />
            </MarketSwitcherFrame>
          )}

          {(mobileTab === "center" ||
            mobileTab === "live" ||
            mobileTab === "news" ||
            mobileTab === "comments") && (
            <MatchCenterTabs
              match={match ?? null}
              liveVideos={liveVideos}
              kickoffMs={match?.kickoffMs}
              activeTab={mobileTab}
              hideTabs
              className="w-full"
              contentClassName="h-140 min-h-0 p-2"
              liveContentClassName="p-2"
              centerWidgetClassName="h-140 min-h-0"
            />
          )}

          {(mobileTab === "positions" ||
            mobileTab === "orders" ||
            mobileTab === "history") && (
            <PortfolioActivitySection activeTab={mobileTab} hideTabs />
          )}

          {mobileTab === "rules" && (
            <div className="rounded-[12px] border border-zinc-800 bg-zinc-900/40">
              <RulesContent
                title={t("extend.worldcup.detail.info.rules")}
                text={selectedMarket?.description || event.description || ""}
                emptyLabel={t("extend.worldcup.detail.info.empty")}
              />
            </div>
          )}

          {mobileTab === "ref" && (
            <div className="rounded-[12px] border border-zinc-800 bg-zinc-900/40">
              <RefContent
                title={t("extend.worldcup.detail.info.ref")}
                sourceLabel={t("extend.worldcup.detail.info.resolutionSource")}
                sources={event.settlement_sources ?? []}
                provider={event.source}
                emptyLabel={t("extend.worldcup.detail.info.empty")}
              />
            </div>
          )}
        </div>

        {/* Trade action modal */}
        {selectedMarket && (
          <TradeModal
            open={tradeSheetOpen}
            onClose={() => setTradeSheetOpen(false)}
            title={t(`extend.worldcup.detail.trade.${side}`)}
          >
            <TradePanel
              event={displayEvent}
              market={tradeMarket ?? selectedMarket}
              outcome={outcome}
              side={side}
              onSideChange={setSide}
              onOutcomeChange={setOutcome}
              onInsufficientBalance={handleInsufficientBalance}
              onSetupRequired={handleSetupRequired}
            />
          </TradeModal>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Desktop layout
  // -------------------------------------------------------------------------
  return (
    <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-4 lg:flex-row lg:items-start">
      {/* LEFT BLOCK: header + chart/markets row + market news/activity. */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <DetailHeader
          event={displayEvent}
          market={selectedDisplayMarket}
          selectedLabel={selectedLabel}
          onBack={() => router.back()}
        />

        <div className="flex min-w-0 flex-col gap-4 xl:h-[560px] xl:flex-row xl:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col gap-4 lg:h-[560px] xl:h-auto">
            {/* Score banner above the price chart */}
            {match && <MatchBanner match={match} />}
            <EventPriceChart
              className="min-w-0 flex-1"
              fillHeight
              event={chartEvent}
              volume={event.volume ?? undefined}
            />
          </div>

          <MatchCenterTabs
            match={match ?? null}
            liveVideos={liveVideos}
            kickoffMs={match?.kickoffMs}
            className="hidden h-full w-[420px] shrink-0 min-[1800px]:flex"
            contentClassName="min-h-0 flex-1 p-2"
            liveContentClassName="min-h-0 flex-1 p-2"
            centerWidgetClassName="h-full min-h-0"
          />

          {selectedMarket && (
            <div className="h-[520px] w-full shrink-0 xl:h-full xl:w-[400px] 2xl:w-[420px]">
              <MarketSwitcherFrame
                title={t("extend.worldcup.detail.markets.title")}
                actionBefore={<OddsFormatSelect />}
                className="h-full"
              >
                <MarketsPanel
                  cats={cats}
                  activeCategory={activeCategory}
                  selectedSlug={selectedSlug}
                  selectedOutcome={outcome}
                  onSelect={handleSelect}
                  className="flex-1 border-0 bg-transparent"
                />
              </MarketSwitcherFrame>
            </div>
          )}
        </div>

        <MatchCenterTabs
          match={match ?? null}
          liveVideos={liveVideos}
          kickoffMs={match?.kickoffMs}
          className="w-full min-[1800px]:hidden"
        />

        {/* Activity spans the chart and markets columns. */}
        <PortfolioActivitySection />
      </div>

      {/* ASIDE: right column — trade form above the order book */}
      {selectedMarket && (
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-2 lg:w-[340px] xl:w-[360px]">
          <div className="rounded-[12px] border border-zinc-800 bg-zinc-900/40 p-3">
            <TradePanel
              event={displayEvent}
              market={tradeMarket ?? selectedMarket}
              outcome={outcome}
              side={side}
              onSideChange={setSide}
              onOutcomeChange={setOutcome}
              onInsufficientBalance={handleInsufficientBalance}
              onSetupRequired={handleSetupRequired}
            />
          </div>

          {/* Order book — vertical (table) mode, beneath the trade form */}
          <div className="flex min-h-[360px] flex-col rounded-[12px] border border-zinc-800 bg-zinc-900/40 p-3">
            <EventMarketDetailWidget
              market={selectedDisplayMarket ?? selectedMarket}
              outcome={outcome}
              onTradeAction={handleTradeAction}
              initialViewMode="table"
              oddsFormatter={oddsFormatter}
              className="min-h-0 flex-1"
            />
          </div>
        </aside>
      )}
    </div>
  );
}

function MarketSwitcherFrame({
  title,
  onClose,
  onAction,
  actionLabel,
  actionIcon,
  actionBefore,
  className,
  children,
}: {
  title: string;
  onClose?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  actionIcon?: ReactNode;
  actionBefore?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const buttonLabel = actionLabel ?? "close";

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[12px] border border-zinc-800 bg-zinc-950",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
          {title}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {actionBefore}
          {(onAction || onClose) && (
            <button
              type="button"
              onClick={onAction || onClose}
              aria-label={buttonLabel}
              title={buttonLabel}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              {actionIcon ?? <CloseIcon />}
            </button>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

type MobileTabKey =
  | "markets"
  | "live"
  | "center"
  | "news"
  | "comments"
  | "positions"
  | "orders"
  | "history"
  | "rules"
  | "ref";

// Mobile flattens what desktop shows as nested tabs into a single tab row:
// match-center sub-tabs (center/news/comments) + the activity sub-tabs
// (positions/orders/history) + the header info popovers (rules/ref, which
// desktop keeps as buttons). Labels reuse existing i18n keys.
const MOBILE_TABS = [
  { key: "markets", labelKey: "extend.worldcup.detail.markets.title" },
  { key: "live", labelKey: "extend.worldcup.live" },
  ...(ENABLE_WORLD_CUP_MATCH_CENTER
    ? [{ key: "center", labelKey: "extend.worldcup.detail.tab.center" } as const]
    : []),
  { key: "news", labelKey: "extend.worldcup.detail.tab.news" },
  { key: "comments", labelKey: "extend.worldcup.detail.tab.comments" },
  { key: "positions", labelKey: "extend.portfolio.positions" },
  { key: "orders", labelKey: "extend.portfolio.openOrders" },
  { key: "history", labelKey: "extend.portfolio.tradeHistory" },
  { key: "rules", labelKey: "extend.worldcup.detail.info.rules" },
  { key: "ref", labelKey: "extend.worldcup.detail.info.ref" },
] as const satisfies readonly { key: MobileTabKey; labelKey: string }[];
