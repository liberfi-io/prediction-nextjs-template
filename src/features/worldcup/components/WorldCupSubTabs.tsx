"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import { WC_TABS, normalizeTab, type WcTab } from "../tabs";

/**
 * World Cup sub-tab navigation (Games / Props / Groups / Bracket).
 *
 * Rendered by the `(list)` layout rather than the page so it persists across
 * tab navigations — switching tabs only swaps the page content below it, the
 * nav itself is never unmounted or rebuilt. The active tab is derived from the
 * pathname because the layout sits above the catch-all `[[...tab]]` segment and
 * therefore never receives its route params.
 */
export function WorldCupSubTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  const active = normalizeTab(pathname.split("/")[2]);

  const go = useCallback(
    (next: WcTab) =>
      router.push(next === "games" ? "/world-cup" : `/world-cup/${next}`),
    [router]
  );

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 py-2 mb-4 border-b border-zinc-800/60 bg-[#0a0a0b]">
        <nav className="-mx-1 flex gap-1 overflow-x-auto no-scrollbar">
          {WC_TABS.map((key) => {
            const isActive = key === active;
            return (
              <button
                key={key}
                type="button"
                onClick={() => go(key)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "shrink-0 cursor-pointer rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-zinc-800/70 text-[#c7ff2e]"
                    : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-200"
                )}
              >
                {t(`extend.worldcup.tab.${key}`)}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
