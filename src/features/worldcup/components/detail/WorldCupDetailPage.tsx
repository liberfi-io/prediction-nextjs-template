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
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useTranslation } from "@liberfi.io/i18n";
import {
  cn,
  ModalBody,
  ModalContent,
  PinIcon as UiPinIcon,
  StyledModal,
  toast,
  UnPinIcon,
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
import type { WcMatch } from "../../types";
import { hasLiveVideos } from "../games/LiveStreamPanel";
import { DetailHeader, RulesContent, RefContent } from "./DetailHeader";
import { MatchBanner } from "./MatchBanner";
import { MatchCenterTabs } from "./MatchCenterTabs";
import { OddsFormatSelect } from "../OddsFormatSelect";
import { MarketsPanel } from "./MarketsPanel";
import { TradePanel } from "./TradePanel";
import { MobileTradeBar } from "./MobileTradeBar";
import { TradeModal } from "src/components/TradeModal";
import { ENABLE_WORLD_CUP_MATCH_CENTER } from "src/libs/featureFlags";
import { convertPrice } from "../../odds/convert-price";
import { useOddsFormat } from "../../odds/OddsFormatProvider";
import {
  categorizeMarkets,
  categoryOfGroup,
  allGroups,
  defaultSelection,
  findSelection,
  type SportsMarketType,
  type TeamHint,
} from "./marketGrouping";
import { normalizeDeepLinkOutcome, resolveMarketDeepLink } from "./deepLink";

/** Shared FIFA logo used for every event avatar on the World Cup detail page. */
const FIFA_AVATAR = "/worldcup/fifa.webp";
const OPTION_ONLY_SURFACE_LABEL_TYPES = new Set<SportsMarketType>([
  "first_half_totals",
  "soccer_first_half_team_totals",
  "second_half_totals",
  "soccer_second_half_team_totals",
  "total_corners",
  "soccer_first_half_total_corners",
  "soccer_second_half_total_corners",
  "soccer_player_goals",
  "soccer_player_goalkeeper_saves",
]);
const marketPanelPinnedAtom = atomWithStorage(
  "worldcup.detail.marketPanelPinned",
  false,
);

type TranslatedEvent = PredictEvent & { title_trans?: unknown };
type TranslatedOutcome = PredictMarket["outcomes"][number] & {
  label_trans?: unknown;
  name_trans?: unknown;
};
type TranslatedMarket = PredictMarket & {
  question_trans?: unknown;
  outcomes?: TranslatedOutcome[];
};
type WorldCupTranslate = (key: `extend.${string}`) => string;

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

/** Team name/code aliases used to orient spread handicaps to the home side. */
function teamHint(match?: WcMatch, t?: WorldCupTranslate): TeamHint | undefined {
  if (!match) return undefined;
  const keys = (...vals: string[]) =>
    new Set(vals.filter(Boolean).map((s) => s.trim().toLowerCase()));
  const homeLabel = t?.(`extend.worldcup.teamName.${match.home.code.toLowerCase()}`);
  const awayLabel = t?.(`extend.worldcup.teamName.${match.away.code.toLowerCase()}`);
  return {
    homeKeys: keys(match.home.name, match.home.code, match.home.nameZh, homeLabel ?? ""),
    awayKeys: keys(match.away.name, match.away.code, match.away.nameZh, awayLabel ?? ""),
    homeLabel,
    awayLabel,
    drawLabel: t?.("extend.worldcup.draw"),
    yesLabel: t?.("extend.worldcup.detail.trade.yes"),
    noLabel: t?.("extend.worldcup.detail.trade.no"),
    firstHalfTotalsLabel: t?.("extend.worldcup.detail.markets.type.first_half_totals"),
    secondHalfTotalsLabel: t?.("extend.worldcup.detail.markets.type.second_half_totals"),
    totalCornersLabel: t?.("extend.worldcup.detail.markets.type.total_corners"),
    firstHalfTotalCornersLabel: t?.(
      "extend.worldcup.detail.markets.type.soccer_first_half_total_corners",
    ),
    secondHalfTotalCornersLabel: t?.(
      "extend.worldcup.detail.markets.type.soccer_second_half_total_corners",
    ),
    playerGoalsLabel: t?.("extend.worldcup.detail.markets.type.soccer_player_goals"),
    playerGoalsShortLabel: t?.("extend.worldcup.detail.markets.type.soccer_player_goals_short"),
    goalkeeperSavesLabel: t?.(
      "extend.worldcup.detail.markets.type.soccer_player_goalkeeper_saves",
    ),
    goalkeeperSavesShortLabel: t?.(
      "extend.worldcup.detail.markets.type.soccer_player_goalkeeper_saves_short",
    ),
  };
}

function matchTitle(match: WcMatch | undefined, hint: TeamHint | undefined): string | undefined {
  if (!match || !hint?.homeLabel || !hint.awayLabel) return undefined;
  return `${hint.homeLabel} vs. ${hint.awayLabel}`;
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
  const showLiveTab = hasLiveVideos(liveVideos);
  const mobileTabs = useMemo(
    () => MOBILE_TABS.filter((tab) => tab.key !== "live" || showLiveTab),
    [showLiveTab],
  );

  const hint = useMemo(() => teamHint(match, translate), [match, translate]);
  const cats = useMemo(
    () => categorizeMarkets(event?.markets ?? [], hint),
    [event?.markets, hint],
  );

  const [selectedSlug, setSelectedSlug] = useState("");
  const [outcome, setOutcome] = useState<TradeOutcome>("yes");
  const [side, setSide] = useState<TradeSide>("buy");
  const [panelOpen, setPanelOpen] = useState(false);
  const [marketPanelPinned, setMarketPanelPinned] = useAtom(
    marketPanelPinnedAtom,
  );

  // Mobile-only UI state
  const [marketsSheetOpen, setMarketsSheetOpen] = useState(false);
  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTabKey>("orderbook");
  const deepLinkAppliedRef = useRef(false);
  const mobileMarketPromptOpenedRef = useRef(false);

  useEffect(() => {
    if (mobileTab === "live" && !showLiveTab) setMobileTab("orderbook");
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
    const found = selectedSlug ? findSelection(cats, selectedSlug) : undefined;
    return found ?? defaultSelection(cats);
  }, [cats, selectedSlug]);

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
    if (mobileMarketPromptOpenedRef.current) return;
    const hasOptions = allGroups(cats).some(
      (group) => group.options.length > 0,
    );
    if (!hasOptions) return;

    mobileMarketPromptOpenedRef.current = true;
    setMarketsSheetOpen(true);
  }, [cats, hasCompleteDeepLink, isDesktop]);

  const handleSelect = useCallback((slug: string) => {
    setSelectedSlug(slug);
    setOutcome("yes");
    setSide("buy");
  }, []);

  const handleTradeAction = useCallback(
    (_market: unknown, oc: TradeOutcome, sd: TradeSide) => {
      setOutcome(oc);
      setSide(sd);
    },
    [],
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

  // Open the trade modal pre-selected to a tapped outcome (buy).
  const handleMobileTradePick = useCallback((oc: TradeOutcome) => {
    setOutcome(oc);
    setSide("buy");
    setTradeSheetOpen(true);
  }, []);

  const handleMobileMarketSelect = useCallback(
    (slug: string) => {
      handleSelect(slug);
      setMarketsSheetOpen(false);
      setTradeSheetOpen(true);
    },
    [handleSelect],
  );

  if (isLoading && !event) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-zinc-500">
        {t("extend.worldcup.detail.loading")}
      </div>
    );
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
  const displayEvent = withTranslatedEventTitle(event, matchTitle(match, hint));
  const selectedGroup = selection?.group;
  const activeCategory = selectedGroup
    ? categoryOfGroup(cats, selectedGroup)
    : "gameLines";

  // Header label, e.g. "Moneyline (Mexico)" / "Totals (0.5)".
  const groupLabel = selectedGroup
    ? t(`extend.worldcup.detail.markets.type.${selectedGroup.type_label}`)
    : "";

  // Display label for one option in the selected group, matching the Markets
  // panel trigger text: "<group> (<option>)" when the group has multiple
  // options (e.g. "Moneyline (Draw)"), else just the group label. Exact-score
  // markets are the exception — the score itself (e.g. "1-0") is the label, with
  // no "Exact Score" prefix.
  const optionDisplayLabel = (optionLabel: string) => {
    if (!selectedGroup) return groupLabel;
    if (selectedGroup.type === "soccer_exact_score") return optionLabel;
    return selectedGroup.options.length > 1
      ? `${groupLabel} (${optionLabel})`
      : groupLabel;
  };
  const selectedSurfaceLabel = (optionLabel: string) => {
    if (!selectedGroup) return groupLabel;
    if (OPTION_ONLY_SURFACE_LABEL_TYPES.has(selectedGroup.type)) return optionLabel;
    return optionDisplayLabel(optionLabel);
  };

  const selectedLabel =
    selectedGroup && selection
      ? selectedSurfaceLabel(selection.option.label)
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
        markets: selectedGroup.options.map((o) =>
          withCleanLabel(o.market, optionDisplayLabel(o.label), hint),
        ),
      }
    : displayEvent;

  // Trade form title mirrors the selected trigger text ("Buy Yes · Moneyline
  // (Draw)"). Display surfaces use settled prices for closed markets so stale
  // 0.001 tail asks do not render as 1000.00 decimal odds.
  const tradeMarket =
    selectedDisplayMarket && selection
      ? withCleanLabel(selectedDisplayMarket, selectedLabel, hint)
      : selectedDisplayMarket;

  // -------------------------------------------------------------------------
  // Mobile layout: single column with one flat tab row (order book + match
  // center / news / comments / positions / orders / history), a sticky trade
  // bar, and modals for the markets switcher and the trade form.
  // -------------------------------------------------------------------------
  if (!isDesktop) {
    return (
      // Bottom padding reserves room for the fixed MobileTradeBar (~73px) so the
      // last content row is never hidden behind it when scrolled to the end.
      <div className="flex w-full flex-col gap-4 pb-4">
        <DetailHeader
          event={displayEvent}
          market={selectedDisplayMarket}
          selectedLabel={selectedLabel}
          panelOpen={marketsSheetOpen}
          onTogglePanel={() => setMarketsSheetOpen((v) => !v)}
          onBack={() => router.back()}
          showInfoButtons={false}
        />

        {match && <MatchBanner match={match} />}

        <EventPriceChart
          event={chartEvent}
          volume={event.volume ?? undefined}
        />

        {/* Tabbed lower content */}
        <div className="flex flex-col gap-3">
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

          {mobileTab === "orderbook" &&
            (selectedMarket ? (
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
            ) : null)}

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

        {/* Sticky buy/sell action bar */}
        {selectedDisplayMarket && (
          <MobileTradeBar
            market={selectedDisplayMarket}
            onPick={handleMobileTradePick}
          />
        )}

        {/* Markets switcher modal (opened from the header dropdown) */}
        <StyledModal
          isOpen={marketsSheetOpen}
          onOpenChange={(open) => {
            if (!open) setMarketsSheetOpen(false);
          }}
          size="lg"
        >
          <ModalContent>
            <ModalBody className="p-0">
              <MarketSwitcherFrame
                title={t("extend.worldcup.detail.markets.title")}
                onClose={() => setMarketsSheetOpen(false)}
                actionBefore={<OddsFormatSelect />}
                className="max-h-[80dvh] border-0 bg-transparent"
              >
                <MarketsPanel
                  cats={cats}
                  activeCategory={activeCategory}
                  selectedSlug={selectedSlug}
                  onSelect={handleMobileMarketSelect}
                  className="flex-1 border-0 bg-transparent"
                />
              </MarketSwitcherFrame>
            </ModalBody>
          </ModalContent>
        </StyledModal>

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
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
      {/* LEFT BLOCK: header + main row + activity (aside spans this whole block) */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <DetailHeader
          event={displayEvent}
          market={selectedDisplayMarket}
          selectedLabel={selectedLabel}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((v) => !v)}
          onClose={() => setPanelOpen(false)}
          onBack={() => router.back()}
          popoverContent={
            <MarketSwitcherFrame
              title={t("extend.worldcup.detail.markets.title")}
              onClose={() => setPanelOpen(false)}
              onAction={() => {
                setMarketPanelPinned((v) => !v);
                setPanelOpen(false);
              }}
              actionLabel={t(
                marketPanelPinned
                  ? "extend.worldcup.detail.markets.unpin"
                  : "extend.worldcup.detail.markets.pin",
              )}
              actionIcon={
                marketPanelPinned ? (
                  <UnPinIcon className="h-3.5 w-3.5" />
                ) : (
                  <UiPinIcon className="h-3.5 w-3.5" />
                )
              }
              actionBefore={<OddsFormatSelect />}
              className="max-h-[70vh]"
            >
              <MarketsPanel
                cats={cats}
                activeCategory={activeCategory}
                selectedSlug={selectedSlug}
                onSelect={handleSelect}
                className="flex-1 border-0 bg-transparent"
              />
            </MarketSwitcherFrame>
          }
        />

        {/* CENTER: optional pinned markets panel + score/chart + match-center */}
        <div className="flex flex-col gap-4 xl:h-[560px] xl:flex-row xl:items-stretch">
          {marketPanelPinned && (
            <MarketSwitcherFrame
              title={t("extend.worldcup.detail.markets.title")}
              onClose={() => setMarketPanelPinned(false)}
              onAction={() => setMarketPanelPinned(false)}
              actionLabel={t("extend.worldcup.detail.markets.unpin")}
              actionIcon={<UnPinIcon className="h-3.5 w-3.5" />}
              actionBefore={<OddsFormatSelect />}
              className="w-full xl:h-full xl:w-[320px]"
            >
              <MarketsPanel
                cats={cats}
                activeCategory={activeCategory}
                selectedSlug={selectedSlug}
                onSelect={handleSelect}
                className="flex-1 border-0 bg-transparent"
              />
            </MarketSwitcherFrame>
          )}

          {/* Score banner above the price chart */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {match && <MatchBanner match={match} />}
            <EventPriceChart
              className="min-w-0 flex-1"
              fillHeight
              event={chartEvent}
              volume={event.volume ?? undefined}
            />
          </div>

          {!marketPanelPinned && (
            <MatchCenterTabs
              match={match ?? null}
              liveVideos={liveVideos}
              kickoffMs={match?.kickoffMs}
              className="w-full shrink-0 xl:w-[440px]"
            />
          )}
        </div>

        {marketPanelPinned && (
          <MatchCenterTabs
            match={match ?? null}
            liveVideos={liveVideos}
            kickoffMs={match?.kickoffMs}
            className="w-full"
          />
        )}

        {/* Activity spans Markets + CENTER width — full multi-source portfolio activity */}
        <PortfolioActivitySection />
      </div>

      {/* ASIDE: right column — trade form above the order book */}
      {selectedMarket && (
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-2 lg:w-[360px]">
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
  onClose: () => void;
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
          <button
            type="button"
            onClick={onAction ?? onClose}
            aria-label={buttonLabel}
            title={buttonLabel}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            {actionIcon ?? <CloseIcon />}
          </button>
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
  | "orderbook"
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
// order book + the match-center sub-tabs (center/news/comments) + the activity
// sub-tabs (positions/orders/history) + the header info popovers (rules/ref,
// which desktop keeps as buttons). Labels reuse existing i18n keys.
const MOBILE_TABS = [
  { key: "orderbook", labelKey: "extend.worldcup.detail.mtab.orderbook" },
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
