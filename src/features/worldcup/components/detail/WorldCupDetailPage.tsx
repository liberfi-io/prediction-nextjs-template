"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { cn, toast } from "@liberfi.io/ui";
import { Chain } from "@liberfi.io/types";
import type { ProviderSource } from "@liberfi.io/react-predict";
import {
  EventPriceChart,
  EventMarketDetailWidget,
  TradeFormWidget,
  SellFormWidget,
  SimilarEventsSection,
  type TradeOutcome,
  type TradeSide,
} from "@liberfi.io/ui-predict";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import { useConnectedWallet } from "@liberfi.io/wallet-connector";
import {
  FUND_WALLET_MODAL_ID,
  type FundWalletParams,
} from "src/components/FundWalletModal";
import { predictEventHref } from "src/components/page/predict-source";
import { EventActivitySection } from "src/components/page/EventActivitySection";
import { useWorldcupMatchEvent, useWorldcupMatches } from "../../data/queries";
import type { WcMatch } from "../../types";
import { DetailHeader } from "./DetailHeader";
import { MatchBanner } from "./MatchBanner";
import { MatchCenterTabs } from "./MatchCenterTabs";
import { MarketsPanel } from "./MarketsPanel";
import {
  categorizeMarkets,
  categoryOfGroup,
  defaultSelection,
  findSelection,
  type TeamHint,
} from "./marketGrouping";

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
  const { onOpen: openFundWallet } =
    useAsyncModal<FundWalletParams>(FUND_WALLET_MODAL_ID);

  const evmWallet = useConnectedWallet(Chain.POLYGON);
  const walletAddress = evmWallet?.address ?? "";

  const { data: event, isLoading } = useWorldcupMatchEvent(id);
  const { data: matches = [] } = useWorldcupMatches();
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

  const handleSimilarEventClick = (ev: {
    slug: string;
    source: ProviderSource;
  }) => {
    router.push(predictEventHref(ev));
  };

  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
      {/* LEFT BLOCK: header + main row + activity (aside spans this whole block) */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <DetailHeader
          event={event}
          selectedLabel={selectedLabel}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((v) => !v)}
          onBack={() => router.back()}
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

          {/* CENTER: banner above an equal-height row of chart | match-center | order book */}
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

              {/* Order book — vertical (table) mode, equal height */}
              {selectedMarket && (
                <div className="flex min-h-[360px] w-full shrink-0 flex-col rounded-[12px] border border-zinc-800 bg-zinc-900/40 p-3 xl:min-h-0 xl:w-[300px]">
                  <EventMarketDetailWidget
                    market={selectedMarket}
                    outcome={outcome}
                    onTradeAction={handleTradeAction}
                    initialViewMode="table"
                    className="min-h-0 flex-1"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Activity spans Markets + CENTER width */}
        <EventActivitySection event={event} walletAddress={walletAddress} />
      </div>

      {/* ASIDE: full-height right column — trade form + similar events */}
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-2 lg:w-[360px]">
        {selectedMarket && (
          <div className="rounded-[12px] border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="mb-3 flex items-center gap-1 rounded-[10px] border border-zinc-800 bg-zinc-900/60 p-0.5">
              <BuySellTab active={side === "buy"} onClick={() => setSide("buy")}>
                {t("extend.worldcup.detail.trade.buy")}
              </BuySellTab>
              <BuySellTab active={side === "sell"} onClick={() => setSide("sell")}>
                {t("extend.worldcup.detail.trade.sell")}
              </BuySellTab>
            </div>
            {side === "sell" ? (
              <SellFormWidget
                key={`sell-${selectedMarket.slug}-${outcome}`}
                event={event}
                market={selectedMarket}
                initialOutcome={outcome}
              />
            ) : (
              <TradeFormWidget
                key={`buy-${selectedMarket.slug}-${outcome}`}
                event={event}
                market={selectedMarket}
                initialOutcome={outcome}
                onInsufficientBalance={handleInsufficientBalance}
              />
            )}
          </div>
        )}

        <SimilarEventsSection
          eventSlug={event.slug}
          source={event.source}
          limit={4}
          onEventClick={handleSimilarEventClick}
        />
      </aside>
    </div>
  );
}

function BuySellTab({
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
        "flex-1 rounded-[8px] py-1.5 text-sm font-medium transition-colors cursor-pointer",
        active ? "bg-zinc-800 text-[#c7ff2e]" : "text-zinc-400 hover:text-zinc-200",
      )}
    >
      {children}
    </button>
  );
}
