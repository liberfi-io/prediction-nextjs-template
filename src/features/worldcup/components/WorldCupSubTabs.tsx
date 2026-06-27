"use client";

import { useEffect, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import { WC_TABS, normalizeTab, type WcTab } from "../tabs";
import {
  setOptimisticWorldCupTab,
  useOptimisticWorldCupTab,
} from "./WorldCupTabTransition";

function tabPath(tab: WcTab): string {
  return tab === "today" ? "/world-cup" : `/world-cup/${tab}`;
}

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

/**
 * World Cup sub-tab navigation (Games / Props / Groups / Bracket).
 *
 * Rendered by the `(list)` layout rather than the page so it persists across
 * tab navigations — switching tabs only swaps the page content below it, the
 * nav itself is never unmounted or rebuilt. The active state is optimistic so
 * it responds immediately, without waiting for the RSC navigation to finish.
 */
export function WorldCupSubTabs() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const routeTab = normalizeTab(pathname.split("/")[2]);
  const optimisticTab = useOptimisticWorldCupTab();

  useEffect(() => {
    if (optimisticTab === routeTab) {
      setOptimisticWorldCupTab(null);
    }
  }, [optimisticTab, routeTab]);

  const active = optimisticTab ?? routeTab;

  const select = (next: WcTab) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return;

    if (next === active) {
      event.preventDefault();
      return;
    }

    setOptimisticWorldCupTab(next);
  };

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 py-2 mb-4 border-b border-zinc-800/60 bg-[#0a0a0b]">
        <nav className="-mx-1 flex gap-1 overflow-x-auto no-scrollbar">
          {WC_TABS.map((key) => {
            const isActive = key === active;
            return (
              <Link
                key={key}
                href={tabPath(key)}
                onClick={select(key)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "shrink-0 cursor-pointer rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-zinc-800/70 text-[#c7ff2e]"
                    : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-200"
                )}
              >
                {t(`extend.worldcup.tab.${key}`)}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
