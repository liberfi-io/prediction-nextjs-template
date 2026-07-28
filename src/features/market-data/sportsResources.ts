import type { MarketDataResourceInput } from "@liberfi.io/react-predict";
import type { SportsMarketDataHydration } from "./server";

export type SportsMarketDataResourceKind = "matches" | "props";
export type SportsMarketDataResourceUpdate = "append" | "replace";

export interface SportsMarketDataResources {
  matches: MarketDataResourceInput[];
  props: MarketDataResourceInput[];
}

export function initialSportsMarketDataResources(
  hydration: SportsMarketDataHydration | undefined,
): SportsMarketDataResources {
  return {
    matches: hydration?.matches ? [hydration.matches] : [],
    props: hydration?.props ? [hydration.props] : [],
  };
}

export function updateSportsMarketDataResources(
  current: SportsMarketDataResources,
  kind: SportsMarketDataResourceKind,
  resource: MarketDataResourceInput | undefined,
  update: SportsMarketDataResourceUpdate,
): SportsMarketDataResources {
  const existing = current[kind];
  const next =
    update === "replace"
      ? resource
        ? [resource]
        : []
      : resource && !existing.some(({ key }) => key === resource.key)
        ? [...existing, resource]
        : existing;
  return next === existing ? current : { ...current, [kind]: next };
}
