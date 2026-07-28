"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  useMarketDataResource,
  type MarketDataCapability,
  type MarketDataResourceInput,
  type MarketDataResourceState,
} from "@liberfi.io/react-predict";
import { useResolvedApiLang } from "src/i18n/ResolvedLocaleProvider";
import { WorldCupDetailPage } from "src/features/worldcup/components/detail/WorldCupDetailPage";
import { adaptSportsMatchDetail } from "../detail/adaptSportsMatchDetail";
import { useSportsMatchLiveState } from "../live/useSportsMatchLiveState";
import { useSportsMatchMarketGroups } from "../live/useSportsMatchMarketGroups";
import type { SportsMatchDetail } from "../types";
import {
  buildSportsMarketDataResource,
  type MarketDataSelectedBook,
} from "../../market-data/resource";
import {
  sportsMatchForMarketDataBranch,
  sportsOrderbookForMarketDataBranch,
} from "../../market-data/sports";

interface SportsMatchDetailPageProps {
  match: SportsMatchDetail;
  initialMarketSlug?: string | null;
  initialOutcome?: string | null;
  marketDataCapability?: MarketDataCapability;
  marketDataResource?: MarketDataResourceInput;
}

/** Renders a generic Sports match through the shared World Cup detail UX. */
export function SportsMatchDetailPage(props: SportsMatchDetailPageProps) {
  if (props.marketDataCapability?.enabled && props.marketDataResource) {
    return <SportsMatchDetailWithMarketData {...props} />;
  }
  return <SportsMatchDetailBody {...props} />;
}

function SportsMatchDetailWithMarketData(props: SportsMatchDetailPageProps) {
  const router = useRouter();
  const baseResource = props.marketDataResource;
  if (!baseResource) {
    throw new Error(
      "Market data resource is required when market data is enabled",
    );
  }
  const initialOutcome =
    props.initialOutcome === "yes" || props.initialOutcome === "no"
      ? props.initialOutcome
      : undefined;
  const initialBook = props.initialMarketSlug
    ? [
        ...(props.match.inline_markets ?? []),
        ...(props.match.market_groups ?? []).flatMap(
          (group) => group.markets ?? [],
        ),
      ]
        .find((market) => market.market_slug === props.initialMarketSlug)
        ?.outcomes?.find((outcome) => outcome.outcome === initialOutcome)
        ?.orderbook
    : undefined;
  const [selectedBook, setSelectedBook] = useState<
    MarketDataSelectedBook | undefined
  >(
    initialBook
      ? {
          source: initialBook.source,
          marketSlug: initialBook.market_slug,
          outcomeKey: initialBook.outcome,
        }
      : undefined,
  );
  const resource = useMemo(
    () =>
      buildSportsMarketDataResource({
        section: props.match.section,
        resource: "detail",
        structure: baseResource.structure,
        structureETag: baseResource.structureETag,
        structurePath: baseResource.structurePath,
        initialQuotes: baseResource.initialQuotes,
        selectedBook,
      }),
    [baseResource, props.match.section, selectedBook],
  );
  const state = useMarketDataResource(resource);
  useEffect(() => {
    if (state.structureInvalidated) router.refresh();
  }, [router, state.structureInvalidated]);
  const handleSelectionChange = useCallback((next: MarketDataSelectedBook) => {
    setSelectedBook((current) =>
      current?.marketSlug === next.marketSlug &&
      current.source === next.source &&
      current.outcomeKey === next.outcomeKey
        ? current
        : next,
    );
  }, []);
  return (
    <SportsMatchDetailBody
      {...props}
      marketDataState={state}
      marketDataSelectedBook={selectedBook}
      onMarketDataSelectionChange={handleSelectionChange}
    />
  );
}

function SportsMatchDetailBody({
  match,
  initialMarketSlug,
  initialOutcome,
  marketDataCapability = { enabled: false },
  marketDataState,
  marketDataSelectedBook,
  onMarketDataSelectionChange,
}: SportsMatchDetailPageProps & {
  marketDataState?: MarketDataResourceState;
  marketDataSelectedBook?: MarketDataSelectedBook;
  onMarketDataSelectionChange?: (selection: MarketDataSelectedBook) => void;
}) {
  const branchMatch = useMemo(
    () =>
      sportsMatchForMarketDataBranch(
        match,
        marketDataCapability.enabled,
        marketDataState,
      ),
    [marketDataCapability.enabled, marketDataState, match],
  );
  const realtimeLiveState = useSportsMatchLiveState(
    branchMatch.section,
    branchMatch.match_group_slug,
  );
  const marketGroups = useSportsMatchMarketGroups(
    branchMatch.section,
    branchMatch.match_group_slug,
    branchMatch.market_groups ?? [],
    { enabled: !marketDataCapability.enabled },
  );
  const viewModel = useMemo(
    () => adaptSportsMatchDetail(branchMatch, marketGroups, realtimeLiveState),
    [branchMatch, marketGroups, realtimeLiveState],
  );
  const marketDataOrderbook = sportsOrderbookForMarketDataBranch(
    marketDataState,
    marketDataSelectedBook?.marketSlug,
    marketDataSelectedBook?.outcomeKey === "yes" ||
      marketDataSelectedBook?.outcomeKey === "no"
      ? marketDataSelectedBook.outcomeKey
      : undefined,
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
          marketDataEnabled={marketDataCapability.enabled}
          marketDataOrderbook={marketDataOrderbook}
          onMarketDataSelectionChange={onMarketDataSelectionChange}
        />
      </div>
    </div>
  );
}

export function SportsMatchDetailSkeleton({
  matchGroupSlug,
  section = "sports",
  initialMarketSlug,
  initialOutcome,
  marketDataCapability,
  marketDataResource,
}: {
  matchGroupSlug: string;
  section?: SportsMatchDetail["section"];
  initialMarketSlug?: string | null;
  initialOutcome?: string | null;
  marketDataCapability?: MarketDataCapability;
  marketDataResource?: MarketDataResourceInput;
}) {
  const lang = useResolvedApiLang();
  const { data } = useQuery({
    queryKey: ["sports", "match-detail", section, matchGroupSlug, lang],
    queryFn: async () => {
      const base = process.env.NEXT_PUBLIC_PREDICT_URL ?? "/predict-api";
      const url = `${base}/api/v1/${encodeURIComponent(section)}/matches/${encodeURIComponent(matchGroupSlug)}?lang=${encodeURIComponent(lang)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Sports match detail request failed: ${response.status}`,
        );
      }
      return (await response.json()) as SportsMatchDetail;
    },
    retry: 3,
    staleTime: 30_000,
  });

  if (data) {
    return (
      <SportsMatchDetailPage
        match={data}
        initialMarketSlug={initialMarketSlug}
        initialOutcome={initialOutcome}
        marketDataCapability={marketDataCapability}
        marketDataResource={marketDataResource}
      />
    );
  }

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
