"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWcT } from "./util";
import { cn } from "@liberfi.io/ui";
import { GamesTab } from "./games/GamesTab";
import { PropsTab } from "./props/PropsTab";
import { GroupsTab } from "./groups/GroupsTab";
import { BracketTab } from "./bracket/BracketTab";
import { WC_TABS, type WcTab } from "../tabs";

export function WorldCupPage({ tab }: { tab: WcTab }) {
  const router = useRouter();
  const t = useWcT();

  const go = useCallback(
    (next: WcTab) => router.push(next === "games" ? "/world-cup" : `/world-cup/${next}`),
    [router],
  );

  return (
    <>
      {/* SUB-TAB ROW */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-zinc-800/60 bg-[#0a0a0b] px-4 py-2 sm:-mx-6 sm:px-6">
        <nav className="-mx-1 flex gap-1 overflow-x-auto no-scrollbar">
          {WC_TABS.map((key) => {
            const active = key === tab;
            return (
              <button
                key={key}
                type="button"
                onClick={() => go(key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 cursor-pointer rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-800/70 text-[#c7ff2e]"
                    : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-200",
                )}
              >
                {t(`worldcup.tab.${key}`)}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB CONTENT */}
      {tab === "games" && <GamesTab />}
      {tab === "props" && <PropsTab />}
      {tab === "groups" && <GroupsTab />}
      {tab === "bracket" && <BracketTab />}
    </>
  );
}
