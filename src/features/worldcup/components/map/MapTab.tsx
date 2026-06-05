"use client";

import { useTranslation } from "@liberfi.io/i18n";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { getProps } from "../../data";
import { TEAMS } from "../../data/teams";
import { useOddsFormat } from "../../odds/OddsFormatProvider";
import { convertPrice } from "../../odds/convert-price";
import { OddsNumber } from "../../odds/OddsNumber";
import { TeamFlag } from "../TeamFlag";

/**
 * P2 placeholder: the geographic choropleth is deferred. For the static
 * preview we show the championship-probability ranking (the H5 "list" view
 * from the layout design), derived from the `world-cup-winner` prop.
 */
export function MapTab() {
  const router = useRouter();
  const { t: _t } = useTranslation();
  const t = _t as (key: string, options?: Record<string, unknown>) => string;
  const [format] = useOddsFormat();

  const winner = useMemo(
    () => getProps().find((p) => p.slug === "world-cup-winner"),
    [],
  );
  if (!winner) return null;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 rounded-[10px] border border-dashed border-zinc-800 px-3 py-2 text-xs text-zinc-500">
        {t("extend.worldcup.mapComingSoon")}
      </div>
      <div className="flex flex-col gap-2">
        {winner.outcomes.map((o, i) => {
          const team = o.teamCode ? TEAMS[o.teamCode.toUpperCase()] : undefined;
          return (
            <button
              key={`${o.label}-${i}`}
              type="button"
              onClick={() => router.push(`/polymarket/${winner.slug}`)}
              className="flex items-center gap-3 rounded-[10px] border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
            >
              <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-zinc-500">
                {i + 1}
              </span>
              {team ? <TeamFlag team={team} size={22} /> : null}
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
                {team ? t("extend.worldcup.teamName." + team.code.toLowerCase()) : o.label}
              </span>
              <span className="text-sm font-semibold text-zinc-100 tabular-nums">
                <OddsNumber value={convertPrice(o.price, format)} variant="fade" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
