import { createHash } from "node:crypto";
import type { PredictEvent, PredictPage } from "@liberfi.io/react-predict";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object"
    ? (value as JsonRecord)
    : {};
}

function structuralOutcome(value: unknown): JsonRecord {
  const outcome = asRecord(value);
  return {
    key: outcome.key,
    label: outcome.label,
    ...(outcome.label_trans ? { label_trans: outcome.label_trans } : {}),
    quote_capable: outcome.quote_capable,
    orderbook_capable: outcome.orderbook_capable,
    price_history_supported: outcome.price_history_supported,
    ...(outcome.book_channel ? { book_channel: outcome.book_channel } : {}),
  };
}

function structuralMarket(value: unknown): JsonRecord {
  const market = asRecord(value);
  return {
    source: market.source,
    market_slug: market.market_slug ?? market.slug,
    question: market.question,
    ...(market.question_trans ? { question_trans: market.question_trans } : {}),
    status: market.status,
    realtime_supported: market.realtime_supported,
    realtime_book_supported: market.realtime_book_supported,
    outcomes: Array.isArray(market.outcomes)
      ? market.outcomes.map(structuralOutcome)
      : [],
  };
}

function structuralEvent(value: unknown): JsonRecord {
  const event = asRecord(value);
  const markets = Array.isArray(event.markets)
    ? event.markets.filter((market) => asRecord(market).status === "open")
    : [];
  return {
    resource_type: event.resource_type ?? "event",
    source: event.source,
    resource_slug: event.resource_slug ?? event.slug,
    ...(event.section ? { section: event.section } : {}),
    title: event.title,
    ...(event.title_trans ? { title_trans: event.title_trans } : {}),
    status: event.status,
    market_view: event.market_view ?? "full",
    markets_included: event.markets_included ?? true,
    ...(event.item_channel ? { item_channel: event.item_channel } : {}),
    markets: markets.map(structuralMarket),
  };
}

export function structureFromComposite(
  page: PredictPage<PredictEvent>,
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
