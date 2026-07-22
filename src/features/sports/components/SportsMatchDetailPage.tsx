"use client";

import { useMemo } from "react";
import { WorldCupDetailPage } from "src/features/worldcup/components/detail/WorldCupDetailPage";
import { adaptSportsMatchDetail } from "../detail/adaptSportsMatchDetail";
import { useSportsMatchLiveState } from "../live/useSportsMatchLiveState";
import { useSportsMatchMarketGroups } from "../live/useSportsMatchMarketGroups";
import type { SportsMatchDetail } from "../types";

interface SportsMatchDetailPageProps {
  match: SportsMatchDetail;
  initialMarketSlug?: string | null;
  initialOutcome?: string | null;
}

/** Renders a generic Sports match through the shared World Cup detail UX. */
export function SportsMatchDetailPage({
  match,
  initialMarketSlug,
  initialOutcome,
}: SportsMatchDetailPageProps) {
  const realtimeLiveState = useSportsMatchLiveState(
    match.section,
    match.match_group_slug,
  );
  const marketGroups = useSportsMatchMarketGroups(
    match.section,
    match.match_group_slug,
    match.market_groups ?? [],
  );
  const viewModel = useMemo(
    () => adaptSportsMatchDetail(match, marketGroups, realtimeLiveState),
    [marketGroups, match, realtimeLiveState],
  );

  return (
    <div className="w-full pb-4 lg:pb-16">
      <div className="w-full px-3 pt-4 sm:px-6">
        <WorldCupDetailPage
          id={match.match_group_slug}
          initialMarketSlug={initialMarketSlug}
          initialOutcome={initialOutcome}
          eventOverride={viewModel.event}
          matchOverride={viewModel.match}
          showMatchCenter={false}
          analyticsSurface="prediction_detail"
        />
      </div>
    </div>
  );
}

export function SportsMatchDetailSkeleton({
  matchGroupSlug,
}: {
  matchGroupSlug: string;
}) {
  return (
    <main className="min-h-[calc(100vh-var(--header-height))] bg-[#09090b] px-3 py-4 text-zinc-100 sm:px-6">
      <div className="mx-auto w-full max-w-[1760px] space-y-4">
        <div className="rounded-[12px] border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="h-4 w-40 animate-pulse rounded bg-zinc-800" />
          <div className="mt-4 h-8 w-full max-w-lg animate-pulse rounded bg-zinc-800" />
          <div className="mt-3 text-sm text-zinc-500">{matchGroupSlug}</div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-[560px] animate-pulse rounded-[12px] border border-zinc-800 bg-zinc-900/40" />
          <div className="h-[560px] animate-pulse rounded-[12px] border border-zinc-800 bg-zinc-900/40" />
        </div>
      </div>
    </main>
  );
}
