"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { cn, toast, useScreen } from "@liberfi.io/ui";
import type { ProviderSource } from "@liberfi.io/react-predict";
import {
  EventPriceChart,
  EventMarketDetailWidget,
  type TradeOutcome,
  type TradeSide,
} from "@liberfi.io/ui-predict";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import {
  FUND_WALLET_MODAL_ID,
  type FundWalletParams,
} from "src/components/FundWalletModal";
import { PortfolioActivitySection } from "src/components/page/PortfolioActivitySection";
import { useWorldcupMatchEvent, useWorldcupMatches } from "../../data/queries";
import type { WcMatch } from "../../types";
import { DetailHeader } from "./DetailHeader";
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

export function WorldCupDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { isDesktop } = useScreen();
  const { onOpen: openFundWallet } =
    useAsyncModal<FundWalletParams>(FUND_WALLET_MODAL_ID);

  const { data: rawEvent, isLoading } = useWorldcupMatchEvent(id);
  const { data: matches = [] } = useWorldcupMatches();
  // Force every event avatar on this page — the header and the buy/sell trade
  // panel (which derives its icon from event.image_url) — to the FIFA logo.
  const event = useMemo(
    () => (rawEvent ? { ...rawEvent, image_url: FIFA_AVATAR } : rawEvent),
    [rawEvent],
  );
  const match = useMemo(
    () => matches.find((m) => m.slug === id),
    [matches, id],
  );

  const cats = useMemo(
    () => categorizeMarkets(event?.markets ?? [], teamHint(match)),
    [event?.markets, match],
  );

  const [selectedSlug, setSelectedSlug] = useState("");
  const [outcome, setOutcome] = useState<TradeOutcome>("yes");
  const [side, setSide] = useState<TradeSide>("buy");
  const [panelOpen, setPanelOpen] = useState(true);

  // Mobile-only UI state
  const [marketsSheetOpen, setMarketsSheetOpen] = useState(false);
  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTabKey>("orderbook");

  // Resolve the active selection, falling back to the first open market.
  const selection = useMemo(() => {
    const found = selectedSlug ? findSelection(cats, selectedSlug) : undefined;
    return found ?? defaultSelection(cats);
  }, [cats, selectedSlug]);

  // Seed the default selection once markets arrive.
  useEffect(() => {
    if (!selectedSlug && selection) setSelectedSlug(selection.option.market.slug);
  }, [selectedSlug, selection]);

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
      toast.error(t("predict.trade.insufficientBalance"));
      openFundWallet({
        params: {
          initialScreen: "deposit",
          initialWallet: src === "polymarket" ? "evm" : "solana",
        },
      });
    },
    [openFundWallet, t],
  );

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
  const selectedLabel =
    selectedGroup && selection
      ? selectedGroup.options.length > 1
        ? `${groupLabel} (${selection.option.label})`
        : groupLabel
      : event.title;

  // The chart plots every market in the selected group (e.g. 3 moneyline lines,
  // or the single totals line), reusing EventPriceChart's multi-market support.
  const chartEvent = selectedGroup
    ? { ...event, markets: selectedGroup.options.map((o) => o.market) }
    : event;

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
          selectedLabel={selectedLabel}
          panelOpen={marketsSheetOpen}
          onTogglePanel={() => setMarketsSheetOpen((v) => !v)}
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
              market={selectedMarket}
              outcome={outcome}
              side={side}
              onSideChange={setSide}
              onInsufficientBalance={handleInsufficientBalance}
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
          selectedLabel={selectedLabel}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((v) => !v)}
        />

        {/* Markets | CENTER — stretched so Markets matches the CENTER height */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          {/* Markets switcher panel — equal height to CENTER, scrolls inside */}
          {panelOpen && (
            <MarketsPanel
              cats={cats}
              activeCategory={activeCategory}
              selectedSlug={selectedSlug}
              onSelect={handleSelect}
              onClose={() => setPanelOpen(false)}
              className="w-full shrink-0 lg:w-[320px]"
            />
          )}

          {/* CENTER: banner above an equal-height row of chart | match-center */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {match && <MatchBanner match={match} />}
            <div className="flex flex-col gap-4 xl:h-[460px] xl:flex-row xl:items-stretch">
              <EventPriceChart
                className="min-w-0 flex-1"
                fillHeight
                event={chartEvent}
                volume={event.volume ?? undefined}
              />

              <MatchCenterTabs
                match={match ?? null}
                className="w-full shrink-0 xl:w-[360px]"
              />
            </div>
          </div>
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
              market={selectedMarket}
              outcome={outcome}
              side={side}
              onSideChange={setSide}
              onInsufficientBalance={handleInsufficientBalance}
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
  | "history";

// Mobile flattens what desktop shows as nested tabs into a single tab row:
// order book + the match-center sub-tabs (center/news/comments) + the activity
// sub-tabs (positions/orders/history). Labels reuse existing i18n keys.
const MOBILE_TABS = [
  { key: "orderbook", labelKey: "extend.worldcup.detail.mtab.orderbook" },
  { key: "center", labelKey: "extend.worldcup.detail.tab.center" },
  { key: "news", labelKey: "extend.worldcup.detail.tab.news" },
  { key: "comments", labelKey: "extend.worldcup.detail.tab.comments" },
  { key: "positions", labelKey: "extend.portfolio.positions" },
  { key: "orders", labelKey: "extend.portfolio.openOrders" },
  { key: "history", labelKey: "extend.portfolio.tradeHistory" },
] as const satisfies readonly { key: MobileTabKey; labelKey: string }[];
