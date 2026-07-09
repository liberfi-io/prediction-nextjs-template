"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import {
  pickBestAsk,
  useRealtimeOrderbook,
} from "@liberfi.io/react-predict";
import type {
  PredictEvent,
  PredictMarket,
  ProviderSource,
} from "@liberfi.io/react-predict";
import {
  TradeFormWidget,
  SellFormWidget,
  type TradeOutcome,
  type TradeSide,
} from "@liberfi.io/ui-predict";
import { convertPrice } from "../../odds/convert-price";
import { displayableBuyPrice } from "../../odds/displayable-price";
import { useOddsFormat } from "../../odds/OddsFormatProvider";
import {
  clearWorldcupOrderbookPrice,
  publishWorldcupOrderbookPrice,
  useWorldcupOrderbookPrice,
} from "../../orderbookPriceStore";
import { sportsType } from "./marketGrouping";

export function formatBuyOddsPrice(
  price: number,
  format: Parameters<typeof convertPrice>[1],
): string {
  return displayableBuyPrice(price) === null ? "-" : convertPrice(price, format);
}

function usesTotalSideLabels(market: PredictMarket): boolean {
  const type = sportsType(market);
  return (
    type === "totals" ||
    type === "first_half_totals" ||
    type === "second_half_totals" ||
    type === "soccer_team_totals" ||
    type === "soccer_first_half_team_totals" ||
    type === "soccer_second_half_team_totals" ||
    type === "soccer_second_half_total_corners" ||
    type === "total_corners" ||
    type === "soccer_first_half_total_corners" ||
    type === "soccer_team_total_corners"
  );
}

function usesCornerSideLabels(market: PredictMarket): boolean {
  return sportsType(market) === "soccer_game_corners_odd_even";
}

export function getTradeOutcomeLabels(
  market: PredictMarket,
  t: (key: `extend.${string}`) => unknown,
): Partial<Record<TradeOutcome, string>> | undefined {
  if (usesTotalSideLabels(market)) {
    return {
      yes: String(t("extend.worldcup.totalSide.over")),
      no: String(t("extend.worldcup.totalSide.under")),
    };
  }
  if (usesCornerSideLabels(market)) {
    return {
      yes: String(t("extend.worldcup.cornerSide.odd")),
      no: String(t("extend.worldcup.cornerSide.even")),
    };
  }
  return undefined;
}

export function getTradeDisplayLabels({
  market,
  outcome,
  side,
  t,
}: {
  market: PredictMarket;
  outcome: TradeOutcome;
  side: TradeSide;
  t: (key: `extend.${string}`) => unknown;
}) {
  const outcomeLabels = getTradeOutcomeLabels(market, t);
  const marketTitle = market.outcomes?.[0]?.label || market.question;
  const actionLabel =
    side === "sell"
      ? String(t("extend.worldcup.detail.trade.sell"))
      : String(t("extend.worldcup.detail.trade.buy"));
  const outcomeLabel =
    outcomeLabels?.[outcome] ??
    (outcome === "yes"
      ? String(t("extend.worldcup.detail.trade.yes"))
      : String(t("extend.worldcup.detail.trade.no")));

  return {
    actionLabel,
    marketTitle,
    outcomeLabel,
    outcomeLabels,
  };
}

export function withOutcomePrice(
  market: PredictMarket,
  outcome: TradeOutcome,
  price: number | undefined,
): PredictMarket {
  if (price === undefined || price <= 0) return market;
  const index = outcome === "yes" ? 0 : 1;
  if (!market.outcomes?.[index]) return market;
  const outcomes = [...market.outcomes];
  const current = outcomes[index];
  if (current.best_ask === price && current.price === price) return market;
  outcomes[index] = { ...current, best_ask: price, price };
  return { ...market, outcomes };
}

/**
 * Buy/Sell trade panel: a segmented Buy/Sell switch above the matching trade
 * form. Shared by the desktop right-rail aside and the trade modal so both
 * surfaces stay visually and behaviourally in sync.
 */
export function TradePanel({
  event,
  market,
  outcome,
  side,
  onSideChange,
  onOutcomeChange,
  onInsufficientBalance,
  onSetupRequired,
  onSuccess,
  initialPositionSide,
}: {
  event: PredictEvent;
  market: PredictMarket;
  outcome: TradeOutcome;
  side: TradeSide;
  initialPositionSide?: string;
  onSideChange: (side: TradeSide) => void;
  onOutcomeChange: (outcome: TradeOutcome) => void;
  onInsufficientBalance?: (source: ProviderSource) => void;
  onSetupRequired?: () => void;
  onSuccess?: () => void;
}) {
  const { t } = useTranslation();
  const [format] = useOddsFormat();
  const sharedOutcomePrice = useWorldcupOrderbookPrice(market.slug, outcome);
  const { data: liveOrderbook } = useRealtimeOrderbook(
    {
      slug: market.slug,
      source: market.source ?? "polymarket",
      outcome,
    },
    { enabled: market.status === "open" },
  );
  const hasLiveOutcomeBook =
    liveOrderbook?.market_id === market.slug && liveOrderbook?.outcome === outcome;
  const liveOutcomePrice = useMemo(() => {
    if (!hasLiveOutcomeBook) {
      return null;
    }
    const ask = pickBestAsk(liveOrderbook, outcome);
    return ask != null && ask > 0 ? ask : null;
  }, [hasLiveOutcomeBook, liveOrderbook, outcome]);

  useEffect(() => {
    if (!hasLiveOutcomeBook) return;
    if (liveOutcomePrice == null || liveOutcomePrice <= 0) {
      clearWorldcupOrderbookPrice(market.slug, outcome);
      return;
    }
    publishWorldcupOrderbookPrice(market.slug, outcome, liveOutcomePrice);
  }, [hasLiveOutcomeBook, liveOutcomePrice, market.slug, outcome]);

  const effectiveMarket = useMemo(
    () => withOutcomePrice(market, outcome, sharedOutcomePrice),
    [market, outcome, sharedOutcomePrice],
  );
  const oddsFormatter = useCallback(
    (price: number) =>
      side === "buy" ? formatBuyOddsPrice(price, format) : convertPrice(price, format),
    [format, side],
  );
  const eventTitle = event.title_trans || event.title;
  const { actionLabel, marketTitle, outcomeLabel, outcomeLabels } = useMemo(
    () => getTradeDisplayLabels({ market: effectiveMarket, outcome, side, t }),
    [effectiveMarket, outcome, side, t],
  );

  return (
    <div className="[&_.worldcup-trade-panel-form>div]:px-2 lg:[&_.worldcup-trade-panel-form>div]:px-4">
      <div className="mb-3 flex items-center gap-1 rounded-[10px] border border-zinc-800 bg-zinc-900/60 p-0.5">
        <BuySellTab
          tone="bullish"
          active={side === "buy"}
          onClick={() => onSideChange("buy")}
        >
          {t("extend.worldcup.detail.trade.buy")}
        </BuySellTab>
        <BuySellTab
          tone="bearish"
          active={side === "sell"}
          onClick={() => onSideChange("sell")}
        >
          {t("extend.worldcup.detail.trade.sell")}
        </BuySellTab>
      </div>
      <div className="mb-4 flex items-center gap-x-3 px-2 lg:px-4">
        {event.image_url && (
          <img
            src={event.image_url}
            alt={eventTitle}
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="flex min-w-0 flex-col gap-y-0.5">
          <span className="line-clamp-1 text-sm leading-tight text-neutral-500">
            {eventTitle}
          </span>
          <span className="line-clamp-1 text-base font-semibold leading-tight">
            <span className="text-foreground">{marketTitle} · </span>
            <span className={cn(side === "buy" ? "text-bullish" : "text-bearish")}>
              {actionLabel} {outcomeLabel}
            </span>
          </span>
        </div>
      </div>
      {side === "sell" ? (
        <div className="worldcup-trade-panel-form">
          <SellFormWidget
            key={`sell-${market.slug}`}
            market={effectiveMarket}
            variant="flat"
            initialOutcome={outcome}
            initialPositionSide={initialPositionSide}
            oddsFormatter={oddsFormatter}
            outcomeLabels={outcomeLabels}
            onOutcomeChange={onOutcomeChange}
            onSetupRequired={onSetupRequired}
            onSuccess={onSuccess}
          />
        </div>
      ) : (
        <div className="worldcup-trade-panel-form">
          <TradeFormWidget
            key={`buy-${market.slug}`}
            market={effectiveMarket}
            variant="flat"
            initialOutcome={outcome}
            oddsFormatter={oddsFormatter}
            outcomeLabels={outcomeLabels}
            onOutcomeChange={onOutcomeChange}
            onInsufficientBalance={onInsufficientBalance}
          />
        </div>
      )}
    </div>
  );
}

function BuySellTab({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "bullish" | "bearish";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-[8px] py-1.5 text-sm font-medium transition-colors cursor-pointer",
        active
          ? tone === "bearish"
            ? "bg-zinc-800 text-bearish"
            : "bg-zinc-800 text-bullish"
          : "text-zinc-400 hover:text-zinc-200",
      )}
    >
      {children}
    </button>
  );
}
