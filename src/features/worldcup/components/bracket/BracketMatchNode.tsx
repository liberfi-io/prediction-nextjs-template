"use client";

import type { WcBracketNode } from "../../types";
import { useTranslation } from "@liberfi.io/i18n";
import { formatDayMonth } from "../util";

function Slot({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-5 min-w-[2.25rem] items-center justify-center rounded bg-zinc-800 px-1.5 text-[11px] font-semibold tabular-nums text-zinc-300">
        {label}
      </span>
    </div>
  );
}

export function BracketMatchNode({ node }: { node: WcBracketNode }) {
  const { t: _t, i18n } = useTranslation(); const t = _t as (key: string, options?: Record<string, unknown>) => string; const lang = i18n.language || "en";
  return (
    <div className="rounded-[10px] border border-zinc-800 bg-zinc-900/50 p-2.5">
      <div className="flex flex-col gap-1.5">
        <Slot label={node.homeLabel} />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase text-zinc-600">
            {t("extend.worldcup.versus")}
          </span>
        </div>
        <Slot label={node.awayLabel} />
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
