"use client";

import type { WcBracketNode, WcTeam } from "../../types";
import { useTranslation } from "@liberfi.io/i18n";
import { formatDayMonth } from "../util";
import { TeamFlag } from "../TeamFlag";

function Slot({
  label,
  team,
  teamLabel,
}: {
  label: string;
  team?: WcTeam;
  teamLabel?: string;
}) {
  if (team) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <TeamFlag team={team} size={18} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-100">
          {teamLabel ?? team.name}
        </span>
        <span className="shrink-0 text-[10px] font-semibold uppercase text-zinc-500">
          {team.code}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-5 min-w-[2.25rem] items-center justify-center rounded bg-zinc-800 px-1.5 text-[11px] font-semibold tabular-nums text-zinc-300">
        {label || "-"}
      </span>
    </div>
  );
}

export function BracketMatchNode({ node }: { node: WcBracketNode }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "en";
  const homeTeamLabel = node.homeTeam
    ? String(t(`extend.worldcup.teamName.${node.homeTeam.code.toLowerCase()}`))
    : undefined;
  const awayTeamLabel = node.awayTeam
    ? String(t(`extend.worldcup.teamName.${node.awayTeam.code.toLowerCase()}`))
    : undefined;

  return (
    <div className="rounded-[10px] border border-zinc-800 bg-zinc-900/50 p-2.5">
      <div className="flex flex-col gap-1.5">
        <Slot label={node.homeLabel} team={node.homeTeam} teamLabel={homeTeamLabel} />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase text-zinc-600">
            {t("extend.worldcup.versus")}
          </span>
        </div>
        <Slot label={node.awayLabel} team={node.awayTeam} teamLabel={awayTeamLabel} />
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-zinc-800/60 pt-1.5 text-[10px] text-zinc-500">
        <span className="truncate">{node.city}</span>
        <span className="shrink-0 tabular-nums">
          {formatDayMonth(node.kickoffMs, lang)}
        </span>
      </div>
    </div>
  );
}
