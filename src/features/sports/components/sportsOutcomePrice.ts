import type { SportsMarketOutcome } from "../types";

/** Resolves the display price shared by sports match and props cards. */
export function sportsOutcomePrice(
  outcome?: SportsMarketOutcome,
): number | undefined {
  return (
    outcome?.price ??
    outcome?.best_ask ??
    outcome?.last_trade_price ??
    outcome?.best_bid
  );
}
