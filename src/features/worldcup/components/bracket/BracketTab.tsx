"use client";

import { useTranslation } from "@liberfi.io/i18n";
import { useMemo, useState } from "react";
import { cn } from "@liberfi.io/ui";
import { BRACKET_ROUNDS } from "../../types";
import { useWorldcupBracket } from "../../data/queries";
import { BracketSkeleton } from "../skeletons";
import { BracketMatchNode } from "./BracketMatchNode";

export function BracketTab() {
  const { t: _t } = useTranslation(); const t = _t as (key: string, options?: Record<string, unknown>) => string;
  const { data: nodes = [], isPending } = useWorldcupBracket();
  const [round, setRound] = useState("r32");

  const byRound = useMemo(() => {
    const map = new Map<string, typeof nodes>();
    for (const n of nodes) {
      if (!map.has(n.round)) map.set(n.round, []);
      map.get(n.round)!.push(n);
    }
    return map;
  }, [nodes]);

  if (isPending) return <BracketSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Desktop (>=1024): horizontal round columns ---------- */}
      <div className="hidden gap-4 overflow-x-auto pb-2 lg:flex">
        {BRACKET_ROUNDS.map((id) => {
          const items = byRound.get(id) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={id} className="flex w-[180px] shrink-0 flex-col gap-2">
              <h3 className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {t(`extend.worldcup.round.${id}`)}
              </h3>
              <div className="flex flex-1 flex-col justify-around gap-2">
                {items.map((n) => (
                  <BracketMatchNode key={n.matchId} node={n} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------- <1024: round segmented + vertical list ---------- */}
      <div className="flex flex-col gap-3 lg:hidden">
        <div className="-mx-3 flex gap-1 overflow-x-auto px-3 no-scrollbar">
          {BRACKET_ROUNDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setRound(id)}
              className={cn(
                "shrink-0 rounded-[8px] px-3 py-1.5 text-xs font-medium transition-colors",
                round === id
                  ? "bg-zinc-800 text-[#c7ff2e]"
                  : "bg-zinc-900/40 text-zinc-500",
              )}
            >
              {t(`extend.worldcup.round.${id}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {(byRound.get(round) ?? []).map((n) => (
            <BracketMatchNode key={n.matchId} node={n} />
          ))}
        </div>
      </div>
    </div>
  );
}
