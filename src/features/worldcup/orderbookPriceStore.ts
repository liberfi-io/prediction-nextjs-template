"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { TradeOutcome } from "@liberfi.io/ui-predict";

export interface WorldcupOrderbookPriceTarget {
  slug: string;
  outcome: TradeOutcome;
}

const prices = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

export function worldcupOrderbookPriceKey(
  slug: string,
  outcome: TradeOutcome,
): string {
  return `${slug}:${outcome}`;
}

function emitChange(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshotVersion(): number {
  return version;
}

export function publishWorldcupOrderbookPrice(
  slug: string | undefined,
  outcome: TradeOutcome | undefined,
  price: number | null | undefined,
): void {
  if (!slug || !outcome || price == null || price <= 0 || !Number.isFinite(price)) {
    return;
  }
  const key = worldcupOrderbookPriceKey(slug, outcome);
  if (prices.get(key) === price) return;
  prices.set(key, price);
  emitChange();
}

export function clearWorldcupOrderbookPrice(
  slug: string | undefined,
  outcome: TradeOutcome | undefined,
): void {
  if (!slug || !outcome) return;
  const key = worldcupOrderbookPriceKey(slug, outcome);
  if (!prices.delete(key)) return;
  emitChange();
}

export function getWorldcupOrderbookPrice(
  slug: string | undefined,
  outcome: TradeOutcome | undefined,
): number | undefined {
  if (!slug || !outcome) return undefined;
  return prices.get(worldcupOrderbookPriceKey(slug, outcome));
}

export function useWorldcupOrderbookPrice(
  slug: string | undefined,
  outcome: TradeOutcome | undefined,
): number | undefined {
  const versionSnapshot = useSyncExternalStore(
    subscribe,
    snapshotVersion,
    snapshotVersion,
  );
  return useMemo(() => {
    void versionSnapshot;
    return getWorldcupOrderbookPrice(slug, outcome);
  }, [outcome, slug, versionSnapshot]);
}

export function useWorldcupOrderbookPriceMap(
  targets: WorldcupOrderbookPriceTarget[],
): Map<string, number> {
  const versionSnapshot = useSyncExternalStore(
    subscribe,
    snapshotVersion,
    snapshotVersion,
  );
  return useMemo(() => {
    void versionSnapshot;
    const next = new Map<string, number>();
    for (const target of targets) {
      const key = worldcupOrderbookPriceKey(target.slug, target.outcome);
      const price = prices.get(key);
      if (price !== undefined) next.set(key, price);
    }
    return next;
  }, [targets, versionSnapshot]);
}
