import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { PredictEvent, ProviderSource } from "@liberfi.io/react-predict";
import { eventQueryKey, fetchEvent } from "@liberfi.io/react-predict/server";
import { notFound, redirect } from "next/navigation";
import { PredictDetailPage } from "src/components/page/PredictDetailPage";
import { createSportsSsrDeadline } from "src/features/sports/route/sportsSsrDeadline";
import {
  resolveSportsEventRoute,
  type SportsMatchDetailLike,
  type SportsRoutingResult,
  type SportsSection,
} from "src/features/sports/route/resolveSportsEventRoute";
import { WorldCupDetailPage } from "src/features/worldcup/components/detail/WorldCupDetailPage";
import { isWorldcupMarketCode } from "src/features/worldcup/components/detail/deepLink";
import { fetchWorldcupMatchEvent } from "src/features/worldcup/data/client";
import {
  resolveWorldcupEventAttribution,
  selectWorldcupMarketSlugForEvent,
} from "src/features/worldcup/data/resolve-event-attribution";
import {
  prefetchWorldcupMatchEvent,
  prefetchWorldcupMatches,
} from "src/features/worldcup/data/prefetch";
import { detectLanguage } from "src/i18n/detectLanguage";
import { mapToApiLang } from "src/i18n/locales";
import { getPredictionLocaleContext } from "src/i18n/predictionLocaleContext";
import { resolveSportsFeatureFlags } from "src/libs/featureFlags";
import { getServerPredictClient } from "src/libs/server/predictClient";
import { createServerQueryClient } from "src/libs/server/queryClient";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ market?: string; outcome?: string }>;
}

const PREFETCH_TIMEOUT_MS = 3000;
const SOURCE_PRIORITY = ["polymarket", "kalshi"] as const;

type ResolvedPredictEvent = {
  event: PredictEvent;
  source: ProviderSource;
  lang: string;
};

type RuntimeSportsClient = {
  getSportsRouting?: (
    slug: string,
    params?: { lang?: string },
  ) => Promise<SportsRoutingResult>;
  getSportsMatchDetail?: (
    section: SportsSection,
    matchGroupSlug: string,
    params?: { lang?: string },
  ) => Promise<SportsMatchDetailLike>;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("prefetch timeout")), timeoutMs),
    ),
  ]);
}

function isNotFoundLikeError(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  if (status === 404) return true;
  if (status && status >= 500) return false;

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (!message) return false;
  if (
    message.includes("internal server error") ||
    message.includes("bad gateway") ||
    message.includes("service unavailable") ||
    message.includes("gateway timeout") ||
    /\b5\d\d\b/.test(message)
  ) {
    return false;
  }
  return message.includes("not found") || /\b404\b/.test(message);
}

async function resolvePredictEventBySlug(
  slug: string,
): Promise<ResolvedPredictEvent | null> {
  const { lang, requestHeaders } = await getPredictionLocaleContext();
  const client = getServerPredictClient({ headers: requestHeaders });

  for (const source of SOURCE_PRIORITY) {
    try {
      const event = await fetchEvent(client, slug, source, lang);
      if (event.slug === slug) return { event, source, lang };
    } catch (error) {
      if (isNotFoundLikeError(error)) continue;
      throw error;
    }
  }
  return null;
}

function canonicalWorldcupHref(
  matchSlug: string,
  marketSlug?: string | null,
  outcome?: string | null,
) {
  const params = new URLSearchParams();
  if (marketSlug) params.set("market", marketSlug);
  if (outcome) params.set("outcome", outcome);
  const qs = params.toString();
  return `/event/${encodeURIComponent(matchSlug)}${qs ? `?${qs}` : ""}`;
}

async function renderWorldcupMatchPage(
  slug: string,
  market: string | null,
  outcome: string | null,
) {
  const lang = mapToApiLang(await detectLanguage());
  const queryClient = createServerQueryClient();

  await withTimeout(
    Promise.all([
      prefetchWorldcupMatchEvent(queryClient, slug, lang),
      prefetchWorldcupMatches(queryClient, lang),
    ]),
    PREFETCH_TIMEOUT_MS,
  ).catch(() => {});

  const isCode = market ? isWorldcupMarketCode(market) : false;
  const initialMarket = isCode ? market : null;
  const initialMarketSlug = !isCode ? market : null;

  return (
    <div className="w-full pb-4 lg:pb-16">
      <div className="w-full px-3 pt-4 sm:px-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <WorldCupDetailPage
            id={slug}
            initialMarket={initialMarket}
            initialMarketSlug={initialMarketSlug}
            initialOutcome={outcome}
          />
        </HydrationBoundary>
      </div>
    </div>
  );
}

function renderSportsMatchSkeleton(matchGroupSlug: string) {
  return (
    <main className="min-h-[calc(100vh-var(--header-height))] bg-[#09090b] px-3 py-4 text-zinc-100 sm:px-6">
      <div className="mx-auto w-full max-w-[1120px] space-y-4">
        <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-4">
          <div className="h-4 w-40 animate-pulse rounded bg-zinc-900" />
          <div className="mt-4 h-8 w-full max-w-lg animate-pulse rounded bg-zinc-900" />
          <div className="mt-3 text-sm text-zinc-500">{matchGroupSlug}</div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-80 animate-pulse rounded-lg border border-zinc-900 bg-zinc-950" />
          <div className="h-80 animate-pulse rounded-lg border border-zinc-900 bg-zinc-950" />
        </div>
      </div>
    </main>
  );
}

export default async function Page({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { market = null, outcome = null } = await searchParams;
  const search = new URLSearchParams();
  if (market) search.set("market", market);
  if (outcome) search.set("outcome", outcome);

  const worldcupAttribution = resolveWorldcupEventAttribution(slug);
  if (worldcupAttribution?.kind === "match") {
    return renderWorldcupMatchPage(
      worldcupAttribution.matchSlug,
      market,
      outcome,
    );
  }

  if (worldcupAttribution?.kind === "event") {
    const base = process.env.PREDICT_URL;
    if (!base) {
      redirect(
        canonicalWorldcupHref(worldcupAttribution.matchSlug, null, outcome),
      );
    }

    const lang = mapToApiLang(await detectLanguage());
    const event = await fetchWorldcupMatchEvent(
      base,
      worldcupAttribution.matchSlug,
      lang,
    ).catch(() => null);
    const marketSlug = event
      ? selectWorldcupMarketSlugForEvent(
          event,
          worldcupAttribution.sourceEventSlug,
        )
      : null;
    redirect(
      canonicalWorldcupHref(worldcupAttribution.matchSlug, marketSlug, outcome),
    );
  }

  const localeContext = await getPredictionLocaleContext();
  const client = getServerPredictClient({
    headers: localeContext.requestHeaders,
  });
  const sportsClient = client as unknown as RuntimeSportsClient;
  const deadline = createSportsSsrDeadline(PREFETCH_TIMEOUT_MS);
  const fallbackCache: { resolved: ResolvedPredictEvent | null } = {
    resolved: null,
  };
  const sportsRoute = await resolveSportsEventRoute({
    slug,
    searchParams: search,
    lang: localeContext.lang,
    flags: resolveSportsFeatureFlags(process.env),
    deadline,
    resolveWorldcupAttribution: () => null,
    fetchSportsRouting: (_slug, lang) =>
      sportsClient.getSportsRouting?.(_slug, { lang }) ?? Promise.resolve(null),
    fetchFallbackEvent: async (_slug) => {
      const resolved = await resolvePredictEventBySlug(_slug);
      fallbackCache.resolved = resolved;
      return resolved ? { event_slug: resolved.event.slug } : null;
    },
    fetchSportsMatchDetail: (section, matchGroupSlug, lang) =>
      sportsClient.getSportsMatchDetail?.(section, matchGroupSlug, { lang }) ??
      Promise.resolve(null),
  });

  if (sportsRoute.kind === "sports_child_redirect") {
    redirect(sportsRoute.redirect_to);
  }

  if (
    sportsRoute.kind === "sports_match" ||
    sportsRoute.kind === "sports_match_skeleton"
  ) {
    return renderSportsMatchSkeleton(sportsRoute.match_group_slug);
  }

  if (sportsRoute.kind === "not_found") {
    notFound();
  }

  const queryClient = createServerQueryClient();
  const eventSlug =
    sportsRoute.kind === "sports_prop" || sportsRoute.kind === "fallback_event"
      ? sportsRoute.event_slug
      : slug;
  const resolved =
    fallbackCache.resolved?.event.slug === eventSlug
      ? fallbackCache.resolved
      : await withTimeout(
          resolvePredictEventBySlug(eventSlug),
          PREFETCH_TIMEOUT_MS,
        );
  if (!resolved) notFound();

  queryClient.setQueryData(
    eventQueryKey(eventSlug, resolved.source, resolved.lang),
    resolved.event,
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PredictDetailPage id={eventSlug} source={resolved.source} />
    </HydrationBoundary>
  );
}
