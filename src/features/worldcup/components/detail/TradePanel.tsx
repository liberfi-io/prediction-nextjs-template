"use client";

import { useCallback } from "react";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import type {
  PredictEvent,
  PredictMarket,
  ProviderSource,
} from "@liberfi.io/react-predict";
import { pickBestAsk, useRealtimeOrderbook } from "@liberfi.io/react-predict";
import {
  TradeFormWidget,
  SellFormWidget,
  type TradeOutcome,
  type TradeSide,
} from "@liberfi.io/ui-predict";
import { convertPrice } from "../../odds/convert-price";
import { displayableBuyPrice } from "../../odds/displayable-price";
import { useOddsFormat } from "../../odds/OddsFormatProvider";

function staticBuyPrice(market: PredictMarket, outcome: TradeOutcome): number | null {
  const target = market.outcomes[outcome === "yes" ? 0 : 1];
  return displayableBuyPrice(target?.best_ask ?? target?.price);
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
}: {
  event: PredictEvent;
  market: PredictMarket;
  outcome: TradeOutcome;
  side: TradeSide;
  onSideChange: (side: TradeSide) => void;
  onOutcomeChange: (outcome: TradeOutcome) => void;
  onInsufficientBalance?: (source: ProviderSource) => void;
  onSetupRequired?: () => void;
}) {
  const { t } = useTranslation();
  const [format] = useOddsFormat();
  const { data: buyOrderbook } = useRealtimeOrderbook(
    { slug: market.slug, source: market.source, outcome },
    { enabled: side === "buy" && market.status === "open" },
  );
  const liveBuyAsk = pickBestAsk(buyOrderbook, outcome);
  const buyPrice =
    liveBuyAsk == null
      ? staticBuyPrice(market, outcome)
      : displayableBuyPrice(liveBuyAsk);
  const oddsFormatter = useCallback(
    (price: number) =>
      side === "buy" && buyPrice === null && displayableBuyPrice(price) === null
        ? "-"
        : convertPrice(price, format),
    [buyPrice, format, side],
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
      {side === "sell" ? (
        <div className="worldcup-trade-panel-form">
          <SellFormWidget
            key={`sell-${market.slug}`}
            event={event}
            market={market}
            variant="flat"
            initialOutcome={outcome}
            oddsFormatter={oddsFormatter}
            onOutcomeChange={onOutcomeChange}
            onSetupRequired={onSetupRequired}
          />
        </div>
      ) : (
        <div className="worldcup-trade-panel-form">
          <TradeFormWidget
            key={`buy-${market.slug}`}
            event={event}
            market={market}
            variant="flat"
            initialOutcome={outcome}
            oddsFormatter={oddsFormatter}
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
