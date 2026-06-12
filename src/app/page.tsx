import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { prefetchWorldcupMatches } from "src/features/worldcup/data/prefetch";
import { HomeLaunchRedirect } from "src/components/page/HomeLaunchRedirect";
import { detectLanguage } from "src/i18n/detectLanguage";
import { mapToApiLang } from "src/i18n/locales";

const PREFETCH_TIMEOUT_MS = 3000;

/**
 * Home route (`/`). This is a thin client-side redirector, not a content page:
 * it renders a launch splash and resolves the Telegram `start_param` (only
 * available client-side) before `router.replace`-ing to the real destination
 * (a World Cup deep link, or `/world-cup` by default). The events market list
 * now lives at `/events`.
 *
 * We SSR-prefetch the matches list so the `wd` matchId→slug lookup resolves
 * from cache instantly, bounded by a 3s race so a slow backend never blocks.
 */
export default async function Page() {
  const lang = mapToApiLang(await detectLanguage());
  const queryClient = createServerQueryClient();

  await Promise.race([
    prefetchWorldcupMatches(queryClient, lang),
    new Promise<void>((_, reject) =>
      setTimeout(
        () => reject(new Error("prefetch timeout")),
        PREFETCH_TIMEOUT_MS,
      ),
    ),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeLaunchRedirect />
    </HydrationBoundary>
  );
}
