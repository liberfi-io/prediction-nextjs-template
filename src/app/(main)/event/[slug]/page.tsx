import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { PredictEvent, ProviderSource } from "@liberfi.io/react-predict";
import { eventQueryKey, fetchEvent } from "@liberfi.io/react-predict/server";
import { notFound, redirect } from "next/navigation";
import { PredictDetailPage } from "src/components/page/PredictDetailPage";
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
import { getServerPredictClient } from "src/libs/server/predictClient";
import { createServerQueryClient } from "src/libs/server/queryClient";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ market?: string; outcome?: string }>;
}

const PREFETCH_TIMEOUT_MS = 3000;
const SOURCE_PRIORITY = ["polymarket", "kalshi"] as const;

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

async function resolvePredictEventBySlug(slug: string): Promise<
  | {
      event: PredictEvent;
      source: ProviderSource;
      lang: string;
    }
  | null
> {
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

export default async function Page({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { market = null, outcome = null } = await searchParams;

  const worldcupAttribution = resolveWorldcupEventAttribution(slug);
  if (worldcupAttribution?.kind === "match") {
    return renderWorldcupMatchPage(worldcupAttribution.matchSlug, market, outcome);
  }

  if (worldcupAttribution?.kind === "event") {
    const base = process.env.PREDICT_URL;
    if (!base) {
      redirect(canonicalWorldcupHref(worldcupAttribution.matchSlug, null, outcome));
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
    redirect(canonicalWorldcupHref(worldcupAttribution.matchSlug, marketSlug, outcome));
  }

  const queryClient = createServerQueryClient();
  const resolved = await withTimeout(
    resolvePredictEventBySlug(slug),
    PREFETCH_TIMEOUT_MS,
  );
  if (!resolved) notFound();

  queryClient.setQueryData(
    eventQueryKey(slug, resolved.source, resolved.lang),
    resolved.event,
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PredictDetailPage id={slug} source={resolved.source} />
    </HydrationBoundary>
  );
}
