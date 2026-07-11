"use client";

import { useSyncExternalStore } from "react";

export type OptimisticNavigationTarget = {
  href: string;
  pathname: string;
  fromPathname: string;
};

const listeners = new Set<() => void>();
let optimisticTarget: OptimisticNavigationTarget | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): OptimisticNavigationTarget | null {
  return optimisticTarget;
}

export function setOptimisticNavigationTarget(
  target: OptimisticNavigationTarget | null,
): void {
  if (
    optimisticTarget?.href === target?.href &&
    optimisticTarget?.pathname === target?.pathname &&
    optimisticTarget?.fromPathname === target?.fromPathname
  ) {
    return;
  }

  optimisticTarget = target;
  for (const listener of listeners) listener();
}

export function useOptimisticNavigationTarget(): OptimisticNavigationTarget | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
