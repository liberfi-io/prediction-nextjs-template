import type { SportsMarketGroup } from "../types";
import type { SportsMarketPatch } from "./channels";

export function mergeSportsMarketPatches(
  groups: SportsMarketGroup[],
  patches: SportsMarketPatch[],
): SportsMarketGroup[] {
  if (patches.length === 0) return groups;
  const patchByKey = new Map<string, SportsMarketPatch>();
  for (const patch of patches) {
    if (!patch.market_slug) continue;
    patchByKey.set(patchKey(patch.market_slug, patch.outcome), patch);
  }
  if (patchByKey.size === 0) return groups;

  let changed = false;
  const nextGroups = groups.map((group) => ({
    ...group,
    markets: (group.markets ?? []).map((market) => {
      let marketChanged = false;
      const outcomes = (market.outcomes ?? []).map((outcome) => {
        const patch = patchByKey.get(
          patchKey(market.market_slug, outcome.outcome),
        );
        if (!patch) return outcome;
        marketChanged = true;
        changed = true;
        return {
          ...outcome,
          best_bid: patch.best_bid ?? outcome.best_bid,
          best_ask: patch.best_ask ?? outcome.best_ask,
          last_trade_price: patch.last_price ?? outcome.last_trade_price,
        };
      });
      return marketChanged ? { ...market, outcomes } : market;
    }),
  }));

  return changed ? nextGroups : groups;
}

function patchKey(marketSlug: string, outcome: string | undefined): string {
  return `${marketSlug}:${outcome ?? ""}`;
}
