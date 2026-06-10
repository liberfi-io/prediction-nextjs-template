"use client";

import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import type { PredictEvent, PredictMarket, ProviderSource } from "@liberfi.io/react-predict";
import {
  TradeFormWidget,
  SellFormWidget,
  type TradeOutcome,
  type TradeSide,
} from "@liberfi.io/ui-predict";

/**
 * Buy/Sell trade panel: a segmented Buy/Sell switch above the matching trade
 * form. Shared by the desktop right-rail aside and the mobile trade action
 * sheet so both surfaces stay visually and behaviourally in sync.
 */
export function TradePanel({
  event,
  market,
  outcome,
  side,
  onSideChange,
  onOutcomeChange,
  onInsufficientBalance,
}: {
  event: PredictEvent;
  market: PredictMarket;
  outcome: TradeOutcome;
  side: TradeSide;
  onSideChange: (side: TradeSide) => void;
  onOutcomeChange: (outcome: TradeOutcome) => void;
  onInsufficientBalance?: (source: ProviderSource) => void;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-3 flex items-center gap-1 rounded-[10px] border border-zinc-800 bg-zinc-900/60 p-0.5">
        <BuySellTab active={side === "buy"} onClick={() => onSideChange("buy")}>
          {t("extend.worldcup.detail.trade.buy")}
        </BuySellTab>
        <BuySellTab active={side === "sell"} onClick={() => onSideChange("sell")}>
          {t("extend.worldcup.detail.trade.sell")}
        </BuySellTab>
      </div>
      {side === "sell" ? (
        <SellFormWidget
          key={`sell-${market.slug}-${outcome}`}
          event={event}
          market={market}
          initialOutcome={outcome}
          onOutcomeChange={onOutcomeChange}
        />
      ) : (
        <TradeFormWidget
          key={`buy-${market.slug}-${outcome}`}
          event={event}
          market={market}
          initialOutcome={outcome}
          onOutcomeChange={onOutcomeChange}
          onInsufficientBalance={onInsufficientBalance}
        />
      )}
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
