"use client";

import { useState } from "react";
import { cn } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import type { WcMatch } from "../../types";
import { SportsWidget } from "../games/SportsWidget";

type CenterTab = "center" | "news" | "comments";

const TABS: CenterTab[] = ["center", "news", "comments"];

/**
 * Center panel tabs mirroring future.news: "Match Center" embeds the shared
 * TheSports live widget; "Market News" and "Comments" are placeholders pending
 * their data sources.
 */
export function MatchCenterTabs({
  match,
  className,
}: {
  match: WcMatch | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<CenterTab>("center");

  return (
    <div
      className={cn(
        "flex flex-col rounded-[12px] border border-zinc-800 bg-zinc-900/40",
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-zinc-800 px-2 py-2">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-[8px] px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              tab === key
                ? "bg-zinc-800 text-[#c7ff2e]"
                : "text-zinc-500 hover:text-zinc-200",
            )}
          >
            {t(`extend.worldcup.detail.tab.${key}`)}
          </button>
        ))}
      </div>

      {/* Content fills remaining height (min 420px) so it can match an
          equal-height row alongside the chart and order book. */}
      <div className="min-h-[420px] flex-1 p-2">
        {tab === "center" ? (
          <SportsWidget match={match} className="h-full min-h-[404px]" />
        ) : (
          <div className="flex h-full min-h-[404px] items-center justify-center text-sm text-zinc-500">
            {t("extend.worldcup.detail.comingSoon")}
          </div>
        )}
      </div>
    </div>
  );
}
