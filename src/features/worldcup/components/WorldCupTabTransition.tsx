"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { WorldCupTabSkeleton } from "./skeletons";
import { normalizeTab, type WcTab } from "../tabs";

const listeners = new Set<() => void>();
let optimisticTab: WcTab | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): WcTab | null {
  return optimisticTab;
}

export function setOptimisticWorldCupTab(tab: WcTab | null): void {
  if (optimisticTab === tab) return;

  optimisticTab = tab;
  for (const listener of listeners) listener();
}

export function useOptimisticWorldCupTab(): WcTab | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/**
 * Shows the next tab's skeleton immediately after a tab click and hides the
 * stale route content until Next.js commits the requested tab route.
 */
export function WorldCupOptimisticTabSkeleton() {
  const pathname = usePathname();
  const routeTab = normalizeTab(pathname.split("/")[2]);
  const tab = useOptimisticWorldCupTab();
  const isPending = tab !== null && tab !== routeTab;

  useEffect(() => {
    if (tab === routeTab) {
      setOptimisticWorldCupTab(null);
    }
  }, [routeTab, tab]);

  if (!isPending) return null;

  return (
    <>
      <style>{`#world-cup-tab-content{display:none}`}</style>
      <WorldCupTabSkeleton tab={tab} />
    </>
  );
}
