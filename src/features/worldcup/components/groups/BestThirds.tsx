"use client";

import { cn } from "@liberfi.io/ui";
import { useWorldcupBestThird } from "../../data/queries";
import { BestThirdsSkeleton } from "../skeletons";
import { TeamFlag } from "../TeamFlag";
import { teamName, useWcLocale, useWcT } from "../util";

const TH = "px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wide text-zinc-600";
const TD = "px-1 py-2 text-right text-[13px] tabular-nums text-zinc-300";

export function BestThirds() {
  const locale = useWcLocale();
  const t = useWcT();
  const { data: rows = [], isPending } = useWorldcupBestThird();

  if (isPending) return <BestThirdsSkeleton />;

  return (
    <div className="mt-3 rounded-[12px] border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">
          {t("worldcup.bestThirds.title")}
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
          {t("worldcup.bestThirds.top8Advance")}
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className={cn(TH, "text-left")}>#</th>
            <th className={cn(TH, "text-left")}>{t("worldcup.team")}</th>
            <th className={TH}>{t("worldcup.groupShort")}</th>
            <th className={TH}>%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.team.code} className="border-b border-zinc-800/40 last:border-0">
              <td className="px-1 py-2 text-left">
                <span
                  className={cn(
                    "inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold tabular-nums",
                    row.qualifies ? "bg-[#c7ff2e]/15 text-[#c7ff2e]" : "text-zinc-500",
                  )}
                >
                  {row.rank}
                </span>
              </td>
              <td className="px-1 py-2 text-left">
                <div className="flex min-w-0 items-center gap-1.5">
                  <TeamFlag team={row.team} size={18} />
                  <span className="truncate text-[13px] text-zinc-200">
                    {teamName(row.team, locale)}
                  </span>
                </div>
              </td>
              <td className={cn(TD, "text-zinc-400")}>{row.group}</td>
              <td className={cn(TD, "text-zinc-400")}>
                {row.advance != null ? Math.round(row.advance * 100) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
