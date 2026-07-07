"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TradeOutcome } from "@liberfi.io/ui-predict";
import {
  pickBestAsk,
  usePredictClient,
  usePredictWsClient,
  type Orderbook,
  type PredictEvent,
  type PredictMarket,
  type ProviderSource,
  type WsDataMessage,
  type WsOrderbookEvent,
} from "@liberfi.io/react-predict";
import type { WcMatch, WcOutcome } from "../../types";

type CardOddsPath =
  | "moneyline.home"
  | "moneyline.draw"
  | "moneyline.away"
  | "spread.home"
  | "spread.away"
  | "total.over"
  | "total.under";

interface CardOddsTarget {
  matchId: string;
  slug: string;
  source: ProviderSource;
  outcome: TradeOutcome;
  path: CardOddsPath;
}

const ORDERBOOK_SEED_BATCH_SIZE = 100;

export function tradeMarketForCode(match: WcMatch, marketCode: string): PredictMarket | null {
  const markets = match.tradeMarkets;
  if (!markets) return null;
  switch (marketCode) {
    case "mlh":
      return markets.moneylineHome ?? null;
    case "mld":
      return markets.moneylineDraw ?? null;
    case "mla":
      return markets.moneylineAway ?? null;
    case "sph":
      return markets.spreadHome ?? null;
    case "spa":
      return markets.spreadAway ?? null;
    default:
      return marketCode === "to" || marketCode.startsWith("to")
        ? markets.total ?? null
        : null;
  }
}

function oddsKey(slug: string, outcome: TradeOutcome): string {
  return `${slug}:${outcome}`;
}

function isTradeOutcome(value: unknown): value is TradeOutcome {
  return value === "yes" || value === "no";
}

function marketSource(market: PredictMarket | null | undefined): ProviderSource {
  return (market?.source ?? "polymarket") as ProviderSource;
}

export function collectCardOddsTargets(matches: WcMatch[]): CardOddsTarget[] {
  const targets: CardOddsTarget[] = [];
  const push = (
    match: WcMatch,
    path: CardOddsPath,
    market: PredictMarket | null,
    outcome: TradeOutcome,
  ) => {
    if (!market?.slug || market.status !== "open") return;
    targets.push({
      matchId: match.matchId,
      slug: market.slug,
      source: marketSource(market),
      outcome,
      path,
    });
  };

  for (const match of matches) {
    if (match.status === "final" || match.liveState?.ended) continue;

    push(match, "moneyline.home", tradeMarketForCode(match, "mlh"), "yes");
    push(match, "moneyline.draw", tradeMarketForCode(match, "mld"), "yes");
    push(match, "moneyline.away", tradeMarketForCode(match, "mla"), "yes");

    const spreadMarketCode = match.spread.line < 0 ? "sph" : "spa";
    const spreadMarket = tradeMarketForCode(match, spreadMarketCode);
    push(match, "spread.home", spreadMarket, match.spread.line < 0 ? "yes" : "no");
    push(match, "spread.away", spreadMarket, match.spread.line < 0 ? "no" : "yes");

    const totalMarket = tradeMarketForCode(match, "to");
    push(match, "total.over", totalMarket, "yes");
    push(match, "total.under", totalMarket, "no");
  }

  return targets;
}

export function useCardOrderbookPrices(targets: CardOddsTarget[]): Map<string, number> {
  const predictClient = usePredictClient();
  const { wsClient } = usePredictWsClient();
  const [pricesByKey, setPricesByKey] = useState<Map<string, number>>(() => new Map());
  const seededKeysRef = useRef<Set<string>>(new Set());

  const targetItemsKey = useMemo(() => {
    const byKey = new Map<string, { slug: string; source: ProviderSource; outcome: TradeOutcome }>();
    for (const target of targets) {
      byKey.set(oddsKey(target.slug, target.outcome), {
        slug: target.slug,
        source: target.source,
        outcome: target.outcome,
      });
    }
    return JSON.stringify([...byKey.values()].sort((a, b) => {
      const slugCompare = a.slug.localeCompare(b.slug);
      return slugCompare || a.outcome.localeCompare(b.outcome);
    }));
  }, [targets]);

  const targetItems = useMemo(
    () =>
      JSON.parse(targetItemsKey) as {
        slug: string;
        source: ProviderSource;
        outcome: TradeOutcome;
      }[],
    [targetItemsKey],
  );
  const targetKeys = useMemo(
    () => new Set(targetItems.map((item) => oddsKey(item.slug, item.outcome))),
    [targetItems],
  );
  const targetSlugs = useMemo(
    () => new Set(targetItems.map((item) => item.slug)),
    [targetItems],
  );
  const targetKeysRef = useRef(targetKeys);
  targetKeysRef.current = targetKeys;

  useEffect(() => {
    const pending = targetItems.filter(
      (item) => !seededKeysRef.current.has(oddsKey(item.slug, item.outcome)),
    );
    if (pending.length === 0) return;

    let cancelled = false;

    const applySeed = (slug: string, outcome: TradeOutcome, price: number | null) => {
      const key = oddsKey(slug, outcome);
      seededKeysRef.current.add(key);
      if (cancelled || price == null || price <= 0) return;
      setPricesByKey((prev) => {
        if (prev.has(key)) return prev;
        const next = new Map(prev);
        next.set(key, price);
        return next;
      });
    };

    const fetchChunk = async (chunk: typeof pending) => {
      try {
        const results = await predictClient.getOrderbooks(
          chunk.map((item) => ({
            slug: item.slug,
            source: item.source,
            outcome: item.outcome,
          })),
        );
        if (cancelled) return;
        for (const result of results) {
          const price =
            result.orderbook?.market_id === result.slug &&
            result.orderbook.outcome === result.outcome
              ? pickBestAsk(result.orderbook, result.outcome)
              : null;
          applySeed(result.slug, result.outcome, price);
        }
      } catch {
        if (cancelled) return;
        for (const item of chunk) applySeed(item.slug, item.outcome, null);
      }
    };

    void (async () => {
      for (let i = 0; i < pending.length; i += ORDERBOOK_SEED_BATCH_SIZE) {
        if (cancelled) return;
        await fetchChunk(pending.slice(i, i + ORDERBOOK_SEED_BATCH_SIZE));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [predictClient, targetItems]);

  useEffect(() => {
    seededKeysRef.current.forEach((key) => {
      if (!targetKeys.has(key)) seededKeysRef.current.delete(key);
    });
    setPricesByKey((prev) => {
      let changed = false;
      const next = new Map<string, number>();
      prev.forEach((price, key) => {
        if (targetKeys.has(key)) {
          next.set(key, price);
          return;
        }
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [targetKeys]);

  useEffect(() => {
    if (!wsClient) return;
    return wsClient.on("orderbook", (msg: WsDataMessage<WsOrderbookEvent>) => {
      const slug = msg.data.market_slug;
      const outcome = msg.data.outcome;
      if (!isTradeOutcome(outcome)) return;
      const key = oddsKey(slug, outcome);
      if (!targetKeysRef.current.has(key)) return;

      const orderbook: Orderbook = {
        market_id: slug,
        outcome,
        bids: msg.data.bids,
        asks: msg.data.asks,
        spread: msg.data.spread,
      };
      const price = pickBestAsk(orderbook, outcome);
      setPricesByKey((prev) => {
        if (price == null || price <= 0) {
          if (!prev.has(key)) return prev;
          const next = new Map(prev);
          next.delete(key);
          return next;
        }
        if (prev.get(key) === price) return prev;
        const next = new Map(prev);
        next.set(key, price);
        return next;
      });
    });
  }, [wsClient]);

  const wsSubscribedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!wsClient) return;
    const current = wsSubscribedRef.current;
    const added: string[] = [];
    const removed: string[] = [];
    targetSlugs.forEach((slug) => {
      if (!current.has(slug)) added.push(slug);
    });
    current.forEach((slug) => {
      if (!targetSlugs.has(slug)) removed.push(slug);
    });
    if (added.length > 0) wsClient.subscribe(["orderbook"], added);
    if (removed.length > 0) wsClient.unsubscribe(["orderbook"], removed);
    wsSubscribedRef.current = new Set(targetSlugs);
  }, [targetSlugs, wsClient]);

  useEffect(() => {
    if (!wsClient) return;
    return () => {
      const all = Array.from(wsSubscribedRef.current);
      if (all.length > 0) wsClient.unsubscribe(["orderbook"], all);
      wsSubscribedRef.current = new Set();
    };
  }, [wsClient]);

  return pricesByKey;
}

function patchOutcomePrice(outcome: WcOutcome, price: number | undefined): WcOutcome {
  if (price === undefined || price <= 0) return outcome;
  if (outcome.price === price && outcome.bestAsk === price) return outcome;
  return { ...outcome, price, bestAsk: price, marketObservedAt: Date.now() };
}

function patchMarketOutcomePrice(
  market: PredictMarket | undefined,
  outcome: TradeOutcome,
  price: number | undefined,
): PredictMarket | undefined {
  if (!market || price === undefined || price <= 0) return market;
  const index = outcome === "yes" ? 0 : 1;
  if (!market.outcomes?.[index]) return market;
  const outcomes = [...market.outcomes];
  const current = outcomes[index];
  if (current.price === price && current.best_ask === price) return market;
  outcomes[index] = { ...current, price, best_ask: price };
  return { ...market, outcomes };
}

function patchEventMarketOutcomePrice(
  event: PredictEvent | undefined,
  slug: string,
  outcome: TradeOutcome,
  price: number | undefined,
): PredictEvent | undefined {
  if (!event?.markets?.length || price === undefined || price <= 0) return event;

  let changed = false;
  const markets = event.markets.map((market) => {
    if (market.slug !== slug) return market;
    const next = patchMarketOutcomePrice(market, outcome, price);
    if (next !== market) changed = true;
    return next ?? market;
  });

  return changed ? { ...event, markets } : event;
}

export function applyCardOrderbookPrices(
  matches: WcMatch[],
  targets: CardOddsTarget[],
  pricesByKey: Map<string, number>,
): WcMatch[] {
  if (pricesByKey.size === 0 || targets.length === 0) return matches;

  const byMatch = new Map<string, CardOddsTarget[]>();
  for (const target of targets) {
    if (!pricesByKey.has(oddsKey(target.slug, target.outcome))) continue;
    const list = byMatch.get(target.matchId) ?? [];
    list.push(target);
    byMatch.set(target.matchId, list);
  }
  if (byMatch.size === 0) return matches;

  let changedAny = false;
  const nextMatches = matches.map((match) => {
    const matchTargets = byMatch.get(match.matchId);
    if (!matchTargets?.length) return match;

    let next = match;
    for (const target of matchTargets) {
      const price = pricesByKey.get(oddsKey(target.slug, target.outcome));
      if (price === undefined) continue;

      switch (target.path) {
        case "moneyline.home":
          next = {
            ...next,
            moneyline: {
              ...next.moneyline,
              home: patchOutcomePrice(next.moneyline.home, price),
            },
          };
          break;
        case "moneyline.draw":
          next = {
            ...next,
            moneyline: {
              ...next.moneyline,
              draw: patchOutcomePrice(next.moneyline.draw, price),
            },
          };
          break;
        case "moneyline.away":
          next = {
            ...next,
            moneyline: {
              ...next.moneyline,
              away: patchOutcomePrice(next.moneyline.away, price),
            },
          };
          break;
        case "spread.home":
          next = {
            ...next,
            spread: {
              ...next.spread,
              home: patchOutcomePrice(next.spread.home, price),
            },
          };
          break;
        case "spread.away":
          next = {
            ...next,
            spread: {
              ...next.spread,
              away: patchOutcomePrice(next.spread.away, price),
            },
          };
          break;
        case "total.over":
          next = {
            ...next,
            total: {
              ...next.total,
              over: patchOutcomePrice(next.total.over, price),
            },
          };
          break;
        case "total.under":
          next = {
            ...next,
            total: {
              ...next.total,
              under: patchOutcomePrice(next.total.under, price),
            },
          };
          break;
      }

      if (next.tradeMarkets) {
        const tradeMarkets = { ...next.tradeMarkets };
        for (const key of Object.keys(tradeMarkets) as Array<keyof typeof tradeMarkets>) {
          const market = tradeMarkets[key];
          if (market?.slug === target.slug) {
            tradeMarkets[key] = patchMarketOutcomePrice(market, target.outcome, price);
          }
        }
        next = { ...next, tradeMarkets };
      }

      const tradeEvent = patchEventMarketOutcomePrice(
        next.tradeEvent,
        target.slug,
        target.outcome,
        price,
      );
      if (tradeEvent !== next.tradeEvent) {
        next = { ...next, tradeEvent };
      }
    }

    if (next !== match) changedAny = true;
    return next;
  });

  return changedAny ? nextMatches : matches;
}
