import { createHash } from "node:crypto";

type JsonRecord = Record<string, unknown>;
interface StructuralCompositePage {
  items: unknown[];
  initial_quotes_contract_enabled?: unknown;
}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object"
    ? (value as JsonRecord)
    : {};
}

function structuralOutcome(value: unknown): JsonRecord {
  const outcome = asRecord(value);
  const orderbook = asRecord(outcome.orderbook);
  return {
    key: outcome.key ?? outcome.outcome,
    label: outcome.label,
    ...(outcome.label_trans ? { label_trans: outcome.label_trans } : {}),
    quote_capable: outcome.quote_capable,
    orderbook_capable: outcome.orderbook_capable,
    price_history_supported: outcome.price_history_supported,
    ...((outcome.book_channel ?? orderbook.book_channel)
      ? { book_channel: outcome.book_channel ?? orderbook.book_channel }
      : {}),
  };
}

function structuralMarket(value: unknown): JsonRecord {
  const market = asRecord(value);
  const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];
  const firstOrderbook = asRecord(asRecord(outcomes[0]).orderbook);
  return {
    source: market.source ?? firstOrderbook.source,
    market_slug: market.market_slug ?? market.slug,
    question: market.question ?? market.label,
    ...(market.question_trans ? { question_trans: market.question_trans } : {}),
    status: market.status,
    realtime_supported: market.realtime_supported,
    realtime_book_supported: market.realtime_book_supported,
    outcomes: outcomes.map(structuralOutcome),
  };
}

function structuralEvent(value: unknown): JsonRecord {
  const event = asRecord(value);
  const groupedMarkets = Array.isArray(event.market_groups)
    ? event.market_groups.flatMap((group) => {
        const markets = asRecord(group).markets;
        return Array.isArray(markets) ? markets : [];
      })
    : [];
  const markets = [
    ...(Array.isArray(event.markets) ? event.markets : []),
    ...(Array.isArray(event.inline_markets) ? event.inline_markets : []),
    ...groupedMarkets,
  ].filter((market) => asRecord(market).status === "open");
  const uniqueMarkets = new Map<string, JsonRecord>();
  markets.map(structuralMarket).forEach((market) => {
    uniqueMarkets.set(
      `${String(market.source)}\u0000${String(market.market_slug)}`,
      market,
    );
  });
  return {
    resource_type: event.resource_type ?? "event",
    source: event.source,
    resource_slug:
      event.resource_slug ??
      event.slug ??
      event.match_group_slug ??
      event.event_slug,
    ...(event.section ? { section: event.section } : {}),
    title: event.title,
    ...(event.title_trans ? { title_trans: event.title_trans } : {}),
    status: event.status,
    market_view: event.market_view ?? "full",
    markets_included: event.markets_included ?? true,
    ...(event.item_channel ? { item_channel: event.item_channel } : {}),
    markets: [...uniqueMarkets.values()],
  };
}

export function structureFromComposite(
  page: StructuralCompositePage,
  upstreamStructureETag: string | null,
): JsonRecord {
  return {
    representation_schema_version: 1,
    initial_quotes_contract_enabled:
      asRecord(page).initial_quotes_contract_enabled ??
      page.items.some((item) => Boolean(asRecord(item).initial_quotes)),
    ...(upstreamStructureETag
      ? { upstream_structure_version: upstreamStructureETag }
      : {}),
    items: page.items.map(structuralEvent),
  };
}

export function filterMarketStructure(value: unknown): JsonRecord {
  const structure = asRecord(value);
  const items = Array.isArray(structure.items)
    ? structure.items
        .filter((item) => asRecord(item).status === "open")
        .map(structuralEvent)
        .filter((item) => {
          const marketsIncluded = item.markets_included !== false;
          return !marketsIncluded || (item.markets as unknown[]).length > 0;
        })
    : [];
  return {
    representation_schema_version: structure.representation_schema_version,
    initial_quotes_contract_enabled: structure.initial_quotes_contract_enabled,
    items,
  };
}

export function marketStructureETag(structure: JsonRecord): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(structure))
    .digest("base64url");
  return `W/"market-structure-v1-${digest}"`;
}

function validatorItem(value: unknown): JsonRecord {
  const item = structuralEvent(value);
  return {
    resource_type: item.resource_type,
    source: item.source,
    resource_slug: item.resource_slug,
    section: item.section,
    title: item.title,
    title_trans: item.title_trans,
    status: item.status,
    market_view: item.market_view,
    markets_included: item.markets_included,
    item_channel: item.item_channel,
    markets: (item.markets as JsonRecord[]).map((market) => ({
      source: market.source,
      market_slug: market.market_slug,
      question: market.question,
      question_trans: market.question_trans,
      status: market.status,
      realtime_supported: market.realtime_supported,
      realtime_book_supported: market.realtime_book_supported,
      outcomes: (market.outcomes as JsonRecord[]).map((outcome) => ({
        key: outcome.key,
        label: outcome.label,
        label_trans: outcome.label_trans,
        quote_capable: outcome.quote_capable,
        orderbook_capable: outcome.orderbook_capable,
        price_history_supported: outcome.price_history_supported,
        book_channel: outcome.book_channel,
      })),
    })),
  };
}

export function marketStructureValidator(
  value: unknown,
  _upstreamStructureETag: string | null,
): JsonRecord {
  const root = asRecord(value);
  return {
    representation_schema_version: root.representation_schema_version,
    initial_quotes_contract_enabled: root.initial_quotes_contract_enabled,
    items: Array.isArray(root.items) ? root.items.map(validatorItem) : [],
  };
}
