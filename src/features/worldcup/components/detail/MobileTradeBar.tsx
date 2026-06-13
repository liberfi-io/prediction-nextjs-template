"use client";

import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import type { PredictMarket } from "@liberfi.io/react-predict";
import {
  pickBestAsk,
  useOrderbook,
  useRealtimeOrderbook,
} from "@liberfi.io/react-predict";
import type { TradeOutcome } from "@liberfi.io/ui-predict";

/** Static fallback price for an outcome before the live orderbook arrives. */
function staticAsk(market: PredictMarket, outcome: TradeOutcome): number {
  const o = market.outcomes[outcome === "yes" ? 0 : 1];
  return o?.best_ask ?? o?.price ?? 0;
}

/** Format a probability in [0,1] as a cents label, e.g. "41¢" / "< 1¢". */
function formatCents(value: number): string {
  const cents = value * 100;
  if (cents > 0 && cents < 1) return "< 1\u00A2";
  return `${Math.round(cents)}\u00A2`;
}

/**
 * Fixed bottom action bar mirroring future.news' mobile event page: two large
 * outcome buttons (YES / NO) with live prices that open the trade modal
 * pre-selected to the tapped outcome.
 *
 * Pinned to the viewport bottom just above the app's mobile tab footer. We use
 * `fixed` (not `sticky`) so it never detaches when the page scrolls to the end,
 * offsetting its bottom by the Scaffold's `--scaffold-footer-height` CSS var so
 * it rests exactly on top of the tab bar (which includes the safe-area inset).
 * The detail page reserves matching bottom padding so content is never hidden.
 */
const BAR_CLASS =
  "fixed inset-x-0 bottom-[var(--scaffold-footer-height,0px)] z-30 border-t border-zinc-800 bg-[#0a0a0b]/95 px-3 py-3 backdrop-blur sm:px-6";
export function MobileTradeBar({
  market,
  onPick,
}: {
  market: PredictMarket;
  onPick: (outcome: TradeOutcome) => void;
}) {
  const { t } = useTranslation();
  const isOpen = market.status === "open";

  const { data: yesOrderbook } = useRealtimeOrderbook(
    { slug: market.slug, source: market.source, outcome: "yes" },
    { enabled: isOpen },
  );
  const { data: noOrderbook } = useOrderbook(
    { slug: market.slug, source: market.source, outcome: "no" },
    { enabled: false, refetchInterval: false },
  );

  const yesPrice = pickBestAsk(yesOrderbook, "yes") ?? staticAsk(market, "yes");
  const noPrice = pickBestAsk(noOrderbook, "no") ?? staticAsk(market, "no");

  const yesLabel = market.outcomes[0]?.label ?? t("extend.worldcup.detail.trade.yes");
  const noLabel = market.outcomes[1]?.label ?? t("extend.worldcup.detail.trade.no");

  if (!isOpen) {
    return (
      <div className={BAR_CLASS}>
        <div className="flex h-12 items-center justify-center rounded-[12px] border border-zinc-800 bg-zinc-900/60 text-sm font-medium text-zinc-500">
          {t("extend.worldcup.detail.markets.closed")}
        </div>
      </div>
    );
  }

  return (
    <div className={BAR_CLASS}>
      <div className="flex items-center gap-3">
        <OutcomeButton
          tone="bullish"
          label={yesLabel}
          price={formatCents(yesPrice)}
          onClick={() => onPick("yes")}
        />
        <OutcomeButton
          tone="bearish"
          label={noLabel}
          price={formatCents(noPrice)}
          onClick={() => onPick("no")}
        />
      </div>
    </div>
  );
}

function OutcomeButton({
  tone,
  label,
  price,
  onClick,
}: {
  tone: "bullish" | "bearish";
  label: string;
  price: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] px-3 text-sm font-semibold transition-all cursor-pointer active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        tone === "bullish"
          ? "bg-bullish/15 text-bullish hover:bg-bullish/25"
          : "bg-bearish/15 text-bearish hover:bg-bearish/25",
      )}
    >
      <span className="truncate">{label}</span>
      <span className="shrink-0 tabular-nums">{price}</span>
    </button>
  );
}
