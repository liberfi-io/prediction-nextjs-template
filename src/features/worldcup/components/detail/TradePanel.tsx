"use client";

import { useCallback } from "react";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
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

function formatBuyOddsPrice(price: number, format: Parameters<typeof convertPrice>[1]): string {
  return displayableBuyPrice(price) === null ? "-" : convertPrice(price, format);
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
  const oddsFormatter = useCallback(
    (price: number) =>
      side === "buy" ? formatBuyOddsPrice(price, format) : convertPrice(price, format),
    [format, side],
  );
  const eventTitle = event.title_trans || event.title;
  const marketTitle = market.outcomes?.[0]?.label || market.question;
  const actionLabel =
    side === "sell"
      ? t("extend.worldcup.detail.trade.sell")
      : t("extend.worldcup.detail.trade.buy");
  const outcomeLabel =
    outcome === "yes"
      ? t("extend.worldcup.detail.trade.yes")
      : t("extend.worldcup.detail.trade.no");

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
