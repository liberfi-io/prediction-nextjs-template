import type {
  PredictEvent,
  PredictPage,
} from "@liberfi.io/react-predict";

export function filterTradableEventMarkets(event: PredictEvent): PredictEvent | null {
  if (event.status !== "open" || !Array.isArray(event.markets)) return null;

  const markets = event.markets.filter((market) => market.status === "open");
  if (markets.length === 0) return null;

  return {
    ...event,
    markets,
  };
}

export function filterTradableEventsPage(
  page: PredictPage<PredictEvent>,
): PredictPage<PredictEvent> {
  const items = Array.isArray(page.items) ? page.items : [];

  return {
    ...page,
    items: items
      .map(filterTradableEventMarkets)
      .filter((event): event is PredictEvent => event !== null),
  };
}
