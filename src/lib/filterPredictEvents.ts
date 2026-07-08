import type {
  PredictEvent,
  PredictPage,
} from "@liberfi.io/react-predict";

type FilterTradableEventsOptions = {
  requireMarkets?: boolean;
};

export function filterTradableEventMarkets(
  event: PredictEvent,
  options: FilterTradableEventsOptions = {},
): PredictEvent | null {
  const { requireMarkets = true } = options;
  if (event.status !== "open") return null;
  if (!Array.isArray(event.markets)) {
    return requireMarkets ? null : event;
  }

  const markets = event.markets.filter((market) => market.status === "open");
  if (markets.length === 0) return null;

  return {
    ...event,
    markets,
  };
}

export function filterTradableEventsPage(
  page: PredictPage<PredictEvent>,
  options: FilterTradableEventsOptions = {},
): PredictPage<PredictEvent> {
  const items = Array.isArray(page.items) ? page.items : [];

  return {
    ...page,
    items: items
      .map((event) => filterTradableEventMarkets(event, options))
      .filter((event): event is PredictEvent => event !== null),
  };
}
