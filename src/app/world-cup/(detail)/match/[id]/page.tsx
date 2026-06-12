import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { WorldCupDetailPage } from "src/features/worldcup/components/detail/WorldCupDetailPage";
import {
  prefetchWorldcupMatchEvent,
  prefetchWorldcupMatches,
} from "src/features/worldcup/data/prefetch";
import { detectLanguage } from "src/i18n/detectLanguage";
import { mapToApiLang } from "src/i18n/locales";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ market?: string; outcome?: string }>;
}

const PREFETCH_TIMEOUT_MS = 3000;

/**
 * World Cup match detail route (`/world-cup/match/{slug}`). SSR-prefetches the
 * full aggregated match event (all market types) and the matches list (for the
 * banner / live widget), bounded by a 3s race so a slow backend never blocks
 * the shell, then hydrates and hands off to the client page.
 */
export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { market, outcome } = await searchParams;
  const lang = mapToApiLang(await detectLanguage());

  const queryClient = createServerQueryClient();

  await Promise.race([
    Promise.all([
      prefetchWorldcupMatchEvent(queryClient, id, lang),
      prefetchWorldcupMatches(queryClient, lang),
    ]),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("prefetch timeout")), PREFETCH_TIMEOUT_MS),
    ),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WorldCupDetailPage
        id={id}
        initialMarket={market ?? null}
        initialOutcome={outcome ?? null}
      />
    </HydrationBoundary>
  );
}
