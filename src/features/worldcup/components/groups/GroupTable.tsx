"use client";

import { useState } from "react";
import { cn } from "@liberfi.io/ui";
import type { WcGroup } from "../../types";
import { useTranslation } from "@liberfi.io/i18n";
import { TeamFlag } from "../TeamFlag";

const TH = "px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wide text-zinc-600";
const TD = "px-1 py-2 text-right text-[13px] tabular-nums text-zinc-300";

export function GroupTable({ group }: { group: WcGroup }) {
  const { t: _t } = useTranslation();
  const t = _t as (key: string, options?: Record<string, unknown>) => string;
  const [expanded, setExpanded] = useState(false);
  const label = t("extend.worldcup.groupLabel", { code: group.code });

  return (
    <div className="rounded-[12px] border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">{label}</h3>
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
          {t("extend.worldcup.advanceProbability")}
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className={cn(TH, "text-left")}>#</th>
            <th className={cn(TH, "text-left")}>{t("extend.worldcup.team")}</th>
            <th className={TH}>P</th>
            <th className={cn(TH, expanded ? "table-cell" : "hidden sm:table-cell")}>W</th>
            <th className={cn(TH, expanded ? "table-cell" : "hidden sm:table-cell")}>D</th>
            <th className={cn(TH, expanded ? "table-cell" : "hidden sm:table-cell")}>L</th>
            <th className={cn(TH, expanded ? "table-cell" : "hidden sm:table-cell")}>GF</th>
            <th className={cn(TH, expanded ? "table-cell" : "hidden sm:table-cell")}>GA</th>
            <th className={cn(TH, expanded ? "table-cell" : "hidden sm:table-cell")}>GD</th>
            <th className={TH}>Pts</th>
            <th className={TH}>%</th>
          </tr>
        </thead>
        <tbody>
          {group.teams.map((row) => {
            const qualifies = row.rank <= 2;
            return (
              <tr key={row.team.code} className="border-b border-zinc-800/40 last:border-0">
                <td className="px-1 py-2 text-left">
                  <span
                    className={cn(
                      "inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold tabular-nums",
                      qualifies ? "bg-[#c7ff2e]/15 text-[#c7ff2e]" : "text-zinc-500",
                    )}
                  >
                    {row.rank}
                  </span>
                </td>
                <td className="px-1 py-2 text-left">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <TeamFlag team={row.team} size={18} />
                    <span className="truncate text-[13px] text-zinc-200">
                      {t("extend.worldcup.teamName." + row.team.code.toLowerCase())}
                    </span>
                  </div>
                </td>
                <td className={TD}>{row.p}</td>
                <td className={cn(TD, expanded ? "table-cell" : "hidden sm:table-cell")}>{row.w}</td>
                <td className={cn(TD, expanded ? "table-cell" : "hidden sm:table-cell")}>{row.d}</td>
                <td className={cn(TD, expanded ? "table-cell" : "hidden sm:table-cell")}>{row.l}</td>
                <td className={cn(TD, expanded ? "table-cell" : "hidden sm:table-cell")}>{row.gf}</td>
                <td className={cn(TD, expanded ? "table-cell" : "hidden sm:table-cell")}>{row.ga}</td>
                <td className={cn(TD, expanded ? "table-cell" : "hidden sm:table-cell")}>{row.gd}</td>
                <td className={cn(TD, "font-semibold text-zinc-100")}>{row.pts}</td>
                <td className={cn(TD, "text-zinc-400")}>
                  {row.advance != null ? Math.round(row.advance * 100) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 w-full text-center text-[11px] font-medium text-zinc-500 hover:text-zinc-300 sm:hidden"
      >
        {expanded ? t("extend.worldcup.collapse") : t("extend.worldcup.expandFullTable")}
      </button>
    </div>
  );
}
