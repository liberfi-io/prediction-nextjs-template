"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { cn, toast, useScreen } from "@liberfi.io/ui";
import type { PredictMarket, ProviderSource } from "@liberfi.io/react-predict";
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
import { applyLiveStateToMatch } from "../../data/client";
import { useWorldcupLiveUpdates } from "../../data/live";
import { useWorldcupMatchEvent, useWorldcupMatches } from "../../data/queries";
import type { WcMatch } from "../../types";
import { DetailHeader, RulesContent, RefContent } from "./DetailHeader";
import { MatchBanner } from "./MatchBanner";
import { MatchCenterTabs } from "./MatchCenterTabs";
import { MarketsPanel } from "./MarketsPanel";
import { TradePanel } from "./TradePanel";
import { MobileTradeBar } from "./MobileTradeBar";
import { BottomSheet } from "./BottomSheet";
import {
  categorizeMarkets,
  categoryOfGroup,
  defaultSelection,
  findSelection,
  type TeamHint,
} from "./marketGrouping";
import { resolveMarketDeepLink } from "./deepLink";

/** Shared FIFA logo used for every event avatar on the World Cup detail page. */
const FIFA_AVATAR = "/worldcup/fifa.webp";

/** Team name/code aliases used to orient spread handicaps to the home side. */
function teamHint(match?: WcMatch): TeamHint | undefined {
  if (!match) return undefined;
  const keys = (...vals: string[]) =>
    new Set(vals.filter(Boolean).map((s) => s.trim().toLowerCase()));
  return {
    homeKeys: keys(match.home.name, match.home.code, match.home.nameZh),
    awayKeys: keys(match.away.name, match.away.code, match.away.nameZh),
  };
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
function withCleanLabel(market: PredictMarket, label: string): PredictMarket {
  const outcomes = market.outcomes?.length
    ? [{ ...market.outcomes[0], label }, ...market.outcomes.slice(1)]
    : market.outcomes;
  return { ...market, question: label, outcomes };
}

export function WorldCupDetailPage({
  id,
  initialMarket = null,
  initialOutcome = null,
}: {
  id: string;
  /** Deep-link market short code from the entry URL (`?market=`). */
  initialMarket?: string | null;
  /** Deep-link outcome short code from the entry URL (`?outcome=`). */
  initialOutcome?: string | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { isDesktop } = useScreen();
  const { onOpen: openFundWallet } =
    useAsyncModal<FundWalletParams>(FUND_WALLET_MODAL_ID);
  const { onOpen: openSetupWallet } = useAsyncModal(SETUP_WALLET_MODAL_ID);
  const { polymarketSetupVerified, kalshiKycVerified } = usePredictWallet();

  const { data: rawEvent, isLoading } = useWorldcupMatchEvent(id);
  const { data: matches = [] } = useWorldcupMatches();
  const liveStates = useWorldcupLiveUpdates();
  // Force every event avatar on this page — the header and the buy/sell trade
  // panel (which derives its icon from event.image_url) — to the FIFA logo.
  const event = useMemo(
    () => (rawEvent ? { ...rawEvent, image_url: FIFA_AVATAR } : rawEvent),
    [rawEvent],
  );
  const match = useMemo(() => {
    const found = matches.find((m) => m.slug === id);
    if (!found) return undefined;
    const liveState = liveStates[found.matchId];
    return liveState ? applyLiveStateToMatch(found, liveState) : found;
  }, [matches, liveStates, id]);

  const cats = useMemo(
    () => categorizeMarkets(event?.markets ?? [], teamHint(match)),
    [event?.markets, match],
  );

  const [selectedSlug, setSelectedSlug] = useState("");
  const [outcome, setOutcome] = useState<TradeOutcome>("yes");
  const [side, setSide] = useState<TradeSide>("buy");
  const [panelOpen, setPanelOpen] = useState(false);

  // Mobile-only UI state
  const [marketsSheetOpen, setMarketsSheetOpen] = useState(false);
  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTabKey>("orderbook");
  const deepLinkAppliedRef = useRef(false);

  const deepLinkMarket = initialMarket?.trim() || null;
  const deepLinkOutcome = initialOutcome?.trim() || null;

  // Resolve the active selection, falling back to the first open market.
  const selection = useMemo(() => {
    const found = selectedSlug ? findSelection(cats, selectedSlug) : undefined;
    return found ?? defaultSelection(cats);
  }, [cats, selectedSlug]);

  // Seed the default selection once markets arrive.
  useEffect(() => {
    if (!selectedSlug && selection) setSelectedSlug(selection.option.market.slug);
  }, [selectedSlug, selection]);

  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    if (!deepLinkMarket) return;
    if (!match) return;

    const hasOptions = [
      ...cats.gameLines,
      ...cats.exactScore,
      ...cats.halftime,
    ].some((group) => group.options.length > 0);
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

  // Open the mobile trade action sheet pre-selected to a tapped outcome (buy).
  const handleMobileTradePick = useCallback((oc: TradeOutcome) => {
    setOutcome(oc);
    setSide("buy");
    setTradeSheetOpen(true);
  }, []);

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

  const selectedLabel =
    selectedGroup && selection
      ? optionDisplayLabel(selection.option.label)
      : event.title;

  // The chart plots every market in the selected group (e.g. 3 moneyline lines,
  // or the single totals line), reusing EventPriceChart's multi-market support.
  // The chart legend / market selector derive their label from
  // `market.outcomes[0].label ?? market.question`. Override those fields so each
  // line reads like the Markets panel trigger ("Moneyline (Draw)") instead of
  // Polymarket's verbose "Draw (Mexico vs. South Africa)". Cloning is shallow;
  // the order book keeps using the original `selectedMarket`.
  const chartEvent = selectedGroup
    ? {
        ...event,
        markets: selectedGroup.options.map((o) =>
          withCleanLabel(o.market, optionDisplayLabel(o.label)),
        ),
      }
    : event;

  // Trade form title mirrors the selected trigger text ("Buy Yes · Moneyline
  // (Draw)"). Order book / mobile trade bar keep the original market so their
  // own outcome rendering is untouched.
  const tradeMarket =
    selectedMarket && selection
      ? withCleanLabel(selectedMarket, selectedLabel)
      : selectedMarket;

  // -------------------------------------------------------------------------
  // Mobile layout: single column with one flat tab row (order book + match
  // center / news / comments / positions / orders / history), a sticky trade
  // bar, and bottom sheets for the markets switcher and the trade form.
  // -------------------------------------------------------------------------
  if (!isDesktop) {
    return (
      // Bottom padding reserves room for the fixed MobileTradeBar (~73px) so the
      // last content row is never hidden behind it when scrolled to the end.
      <div className="flex w-full flex-col gap-4 pb-4">
        <DetailHeader
          event={event}
          market={selectedMarket}
          selectedLabel={selectedLabel}
          panelOpen={marketsSheetOpen}
          onTogglePanel={() => setMarketsSheetOpen((v) => !v)}
          onBack={() => router.back()}
          showInfoButtons={false}
        />

        {match && <MatchBanner match={match} />}

        <EventPriceChart event={chartEvent} volume={event.volume ?? undefined} />

        {/* Tabbed lower content */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1 overflow-x-auto rounded-[10px] border border-zinc-800 bg-zinc-900/60 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {MOBILE_TABS.map(({ key, labelKey }) => (
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
                {t(labelKey)}
              </button>
            ))}
          </div>

          {mobileTab === "orderbook" &&
            (selectedMarket ? (
              <div className="flex min-h-[360px] flex-col rounded-[12px] border border-zinc-800 bg-zinc-900/40 p-3">
                <EventMarketDetailWidget
                  market={selectedMarket}
                  outcome={outcome}
                  onTradeAction={handleTradeAction}
                  initialViewMode="table"
                  className="min-h-0 flex-1"
                />
              </div>
            ) : null)}

          {(mobileTab === "center" ||
            mobileTab === "news" ||
            mobileTab === "comments") && (
            <MatchCenterTabs
              match={match ?? null}
              activeTab={mobileTab}
              hideTabs
              className="w-full"
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
        {selectedMarket && (
          <MobileTradeBar market={selectedMarket} onPick={handleMobileTradePick} />
        )}

        {/* Markets switcher sheet (opened from the header dropdown) */}
        <BottomSheet
          open={marketsSheetOpen}
          onClose={() => setMarketsSheetOpen(false)}
          className="max-h-[80dvh]"
        >
          <MarketsPanel
            cats={cats}
            activeCategory={activeCategory}
            selectedSlug={selectedSlug}
            onSelect={(slug) => {
              handleSelect(slug);
              setMarketsSheetOpen(false);
            }}
            onClose={() => setMarketsSheetOpen(false)}
            className="border-0 bg-transparent"
          />
        </BottomSheet>

        {/* Trade action sheet */}
        {selectedMarket && (
          <BottomSheet
            open={tradeSheetOpen}
            onClose={() => setTradeSheetOpen(false)}
            className="px-4 pb-4"
          >
            <TradePanel
              event={event}
              market={tradeMarket ?? selectedMarket}
              outcome={outcome}
              side={side}
              onSideChange={setSide}
              onOutcomeChange={setOutcome}
              onInsufficientBalance={handleInsufficientBalance}
              onSetupRequired={handleSetupRequired}
            />
          </BottomSheet>
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
          event={event}
          market={selectedMarket}
          selectedLabel={selectedLabel}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((v) => !v)}
          onClose={() => setPanelOpen(false)}
          onBack={() => router.back()}
          popoverContent={
            <MarketsPanel
              cats={cats}
              activeCategory={activeCategory}
              selectedSlug={selectedSlug}
              onSelect={handleSelect}
              onClose={() => setPanelOpen(false)}
              className="max-h-[70vh]"
            />
          }
        />

        {/* CENTER: (score + chart) column beside the (widened) match-center column */}
        <div className="flex flex-col gap-4 xl:h-[560px] xl:flex-row xl:items-stretch">
          {/* Column 1: score banner above the price chart */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {match && <MatchBanner match={match} />}
            <EventPriceChart
              className="min-w-0 flex-1"
              fillHeight
              event={chartEvent}
              volume={event.volume ?? undefined}
            />
          </div>

          {/* Column 2: match center, widened */}
          <MatchCenterTabs
            match={match ?? null}
            className="w-full shrink-0 xl:w-[440px]"
          />
        </div>

        {/* Activity spans Markets + CENTER width — full multi-source portfolio activity */}
        <PortfolioActivitySection />
      </div>

      {/* ASIDE: right column — trade form above the order book */}
      {selectedMarket && (
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-2 lg:w-[360px]">
          <div className="rounded-[12px] border border-zinc-800 bg-zinc-900/40 p-3">
            <TradePanel
              event={event}
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
              market={selectedMarket}
              outcome={outcome}
              onTradeAction={handleTradeAction}
              initialViewMode="table"
              className="min-h-0 flex-1"
            />
          </div>
        </aside>
      )}
    </div>
  );
}

type MobileTabKey =
  | "orderbook"
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
  { key: "center", labelKey: "extend.worldcup.detail.tab.center" },
  { key: "news", labelKey: "extend.worldcup.detail.tab.news" },
  { key: "comments", labelKey: "extend.worldcup.detail.tab.comments" },
  { key: "positions", labelKey: "extend.portfolio.positions" },
  { key: "orders", labelKey: "extend.portfolio.openOrders" },
  { key: "history", labelKey: "extend.portfolio.tradeHistory" },
  { key: "rules", labelKey: "extend.worldcup.detail.info.rules" },
  { key: "ref", labelKey: "extend.worldcup.detail.info.ref" },
] as const satisfies readonly { key: MobileTabKey; labelKey: string }[];
