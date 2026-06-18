import type { PredictEvent } from "@liberfi.io/react-predict";
import { WORLD_CUP_MATCH_SLUGS, worldcupMatchSlugFromEventSlug } from "./schedule";

export type WorldcupEventAttribution =
  | { kind: "match"; matchSlug: string }
  | { kind: "event"; matchSlug: string; sourceEventSlug: string };

export function resolveWorldcupEventAttribution(
  slug: string,
): WorldcupEventAttribution | null {
  if (WORLD_CUP_MATCH_SLUGS.has(slug)) {
    return { kind: "match", matchSlug: slug };
  }

  const matchSlug = worldcupMatchSlugFromEventSlug(slug);
  if (!matchSlug) return null;
  return { kind: "event", matchSlug, sourceEventSlug: slug };
}

export function selectWorldcupMarketSlugForEvent(
  event: PredictEvent,
  sourceEventSlug: string,
): string | null {
  const markets =
    event.markets?.filter((market) => market.event_slug === sourceEventSlug) ??
    [];
  const selected =
    markets.find((market) => market.status === "open") ??
    markets.find((market) => market.outcomes.length > 0) ??
    markets[0];
  return selected?.slug ?? null;
}
