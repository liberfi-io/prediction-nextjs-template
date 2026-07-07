"use client";

import { useTranslation } from "@liberfi.io/i18n";
import { useMemo, useState } from "react";
import { cn } from "@liberfi.io/ui";
import { BRACKET_ROUNDS } from "../../types";
import { useWorldcupBracket } from "../../data/queries";
import { BracketSkeleton } from "../skeletons";
import { BracketMatchNode } from "./BracketMatchNode";

const BRACKET_VISUAL_MATCH_ORDER: Record<string, string[]> = {
  r32: [
    "M73",
    "M75",
    "M74",
    "M77",
    "M83",
    "M84",
    "M81",
    "M82",
    "M76",
    "M78",
    "M79",
    "M80",
    "M86",
    "M88",
    "M85",
    "M87",
  ],
  r16: ["M89", "M90", "M93", "M94", "M91", "M92", "M95", "M96"],
  r8: ["M97", "M98", "M99", "M100"],
  r4: ["M101", "M102"],
  r3rd: ["M103"],
  final: ["M104"],
};

function bracketSortValue(round: string, matchId: string): number {
  const order = BRACKET_VISUAL_MATCH_ORDER[round];
  const index = order?.indexOf(matchId) ?? -1;
  if (index !== -1) return index;

  const numericId = Number(matchId.replace(/^M/i, ""));
  return Number.isFinite(numericId) ? 1000 + numericId : Number.MAX_SAFE_INTEGER;
}

export function BracketTab() {
  const { t } = useTranslation();
  const { data: nodes = [], isPending } = useWorldcupBracket();
  const [round, setRound] = useState("r8");

  const byRound = useMemo(() => {
    const map = new Map<string, typeof nodes>();
    for (const n of nodes) {
      if (!map.has(n.round)) map.set(n.round, []);
      map.get(n.round)!.push(n);
    }
    for (const [roundId, items] of map) {
      items.sort(
        (a, b) =>
          bracketSortValue(roundId, a.matchId) - bracketSortValue(roundId, b.matchId),
      );
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
