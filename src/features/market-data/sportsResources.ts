import type { MarketDataResourceInput } from "@liberfi.io/react-predict";
import type { SportsPageFilters, SportsSection } from "../sports/types";
import type { SportsMarketDataHydration } from "./server";

export type SportsMarketDataResourceKind = "matches" | "props";
export type SportsMarketDataResourceUpdate = "append" | "replace";

export interface SportsMarketDataResources {
  matches: MarketDataResourceInput[];
  props: MarketDataResourceInput[];
}

/** Returns the React owner key for one server-routed Sports resource generation. */
export function sportsMarketDataOwnerKey(input: {
  section: SportsSection;
  lang?: string;
  filters: SportsPageFilters;
  hydration?: SportsMarketDataHydration;
}): string {
  return [
    input.section,
    input.lang ?? "",
    input.filters.view ?? "",
    input.filters.taxonomy_type ?? "",
    input.filters.taxonomy_slug ?? "",
    input.filters.start_time_gte ?? "",
    input.filters.start_time_lt ?? "",
    input.filters.live_range_start ?? "",
    input.hydration?.matches?.key ?? "",
    input.hydration?.props?.key ?? "",
  ].join("\u0000");
}

/** Creates the mounted resource set from the server-rendered hydration payload. */
export function initialSportsMarketDataResources(
  hydration: SportsMarketDataHydration | undefined,
): SportsMarketDataResources {
  return {
    matches: hydration?.matches ? [hydration.matches] : [],
    props: hydration?.props ? [hydration.props] : [],
  };
}

/** Appends a pagination generation or replaces one resource kind after navigation. */
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
