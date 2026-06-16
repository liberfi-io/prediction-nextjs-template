"use client";

import { useEffect, useMemo, useState } from "react";
import { cn, EmptyIcon } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import { EventCommentsWidget } from "@liberfi.io/ui-predict";
import { ENABLE_WORLD_CUP_MATCH_CENTER } from "src/libs/featureFlags";
import type { WcMatch, WcMatchLiveVideo } from "../../types";
import { SportsWidget } from "../games/SportsWidget";
import { hasLiveVideos, LiveStreamPanel } from "../games/LiveStreamPanel";
import { MarketNewsWidget } from "./feeds/MarketNewsWidget";

export type CenterTab = "live" | "center" | "news" | "comments";

/**
 * Center panel tabs mirroring future.news: "Match Center" embeds the shared
 * TheSports live widget; "Market News" and "Comments" are placeholders pending
 * their data sources.
 *
 * On desktop it owns its own sub-tab bar. On mobile the detail page flattens
 * these into top-level tabs, so it can be driven externally via `activeTab`
 * with `hideTabs` to suppress the internal bar.
 */
export function MatchCenterTabs({
  match,
  liveVideos,
  kickoffMs,
  className,
  contentClassName = "min-h-[420px] flex-1 p-2",
  liveContentClassName = "p-2",
  centerWidgetClassName = "h-full min-h-[404px]",
  activeTab,
  hideTabs = false,
}: {
  match: WcMatch | null;
  liveVideos?: WcMatchLiveVideo[] | null;
  kickoffMs?: number;
  className?: string;
  contentClassName?: string;
  liveContentClassName?: string;
  centerWidgetClassName?: string;
  activeTab?: CenterTab;
  hideTabs?: boolean;
}) {
  const { t } = useTranslation();
  const showLive = hasLiveVideos(liveVideos);
  const tabs = useMemo<CenterTab[]>(
    () => {
      const centerTabs: CenterTab[] = ENABLE_WORLD_CUP_MATCH_CENTER
        ? ["center", "news", "comments"]
        : ["news", "comments"];
      return showLive ? ["live", ...centerTabs] : centerTabs;
    },
    [showLive],
  );
  const [internalTab, setInternalTab] = useState<CenterTab>("center");
  const requestedTab = activeTab ?? internalTab;
  const tab = tabs.includes(requestedTab) ? requestedTab : tabs[0];

  useEffect(() => {
    if (!tabs.includes(internalTab)) setInternalTab(tabs[0]);
  }, [internalTab, tabs]);

  return (
    <div
      className={cn(
        "flex flex-col rounded-[12px] border border-zinc-800 bg-zinc-900/40",
        className,
      )}
    >
      {!hideTabs && (
        <div className="flex items-center gap-1 border-b border-zinc-800 px-2 py-2">
          {tabs.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setInternalTab(key)}
              className={cn(
                "rounded-[8px] px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                tab === key
                  ? "bg-zinc-800 text-[#c7ff2e]"
                  : "text-zinc-500 hover:text-zinc-200",
              )}
            >
              {key === "live"
                ? t("extend.worldcup.live")
                : t(`extend.worldcup.detail.tab.${key}`)}
            </button>
          ))}
        </div>
      )}

      {/* Content fills remaining height (min 420px) so it can match an
          equal-height row alongside the chart and order book. */}
      <div className={tab === "live" ? liveContentClassName : contentClassName}>
        {tab === "live" ? (
          <LiveStreamPanel
            videos={liveVideos}
            kickoffMs={kickoffMs}
          />
        ) : tab === "center" ? (
          <SportsWidget
            match={match}
            className={centerWidgetClassName}
            bordered={false}
          />
        ) : tab === "comments" ? (
          match ? (
            <EventCommentsWidget
              slug={match.slug}
              source="polymarket"
              className="h-full min-h-[404px]"
            />
          ) : (
            <CenterEmpty message={t("extend.worldcup.detail.commentsEmpty")} />
          )
        ) : match ? (
          <MarketNewsWidget slug={match.slug} className="h-full min-h-[404px]" />
        ) : (
          <CenterEmpty message={t("extend.worldcup.detail.newsEmpty")} />
        )}
      </div>
    </div>
  );
}

/**
 * Empty/placeholder state for center tabs with no data yet (icon + hint), so an
 * empty tab never renders as a blank panel.
 */
function CenterEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[404px] flex-col items-center justify-center gap-2 text-sm text-zinc-500">
      <EmptyIcon width={28} height={28} className="text-zinc-600" />
      <span>{message}</span>
    </div>
  );
}
