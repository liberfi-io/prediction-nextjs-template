import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { cookies, headers } from "next/headers";
import { i18nCookieKey } from "@liberfi.io/i18n/server";
import {
  resolveEventsParams,
  infiniteEventsQueryKey,
  fetchEventsPage,
} from "@liberfi.io/react-predict/server";
import { getServerPredictClient } from "src/libs/server/predictClient";
import { createServerQueryClient } from "src/libs/server/queryClient";
import { PredictListPage } from "src/components/page/PredictListPage";
import { ENABLE_KALSHI } from "src/libs/featureFlags";
import { detectLanguage } from "src/i18n/detectLanguage";
import { mapToApiLang } from "src/i18n/locales";
import { filterTradableEventsPage } from "src/lib/filterPredictEvents";

async function getPredictionLocaleContext() {
  const [lang, cookieStore, headerStore] = await Promise.all([
    detectLanguage(),
    cookies(),
    headers(),
  ]);
  const cookieLang = cookieStore.get(i18nCookieKey)?.value;
  const acceptLanguage = headerStore.get("accept-language");
  const requestHeaders: HeadersInit = {};

  if (cookieLang) {
    requestHeaders.Cookie = `${i18nCookieKey}=${encodeURIComponent(cookieLang)}`;
  }
  if (acceptLanguage) {
    requestHeaders["Accept-Language"] = acceptLanguage;
  }

  return {
    lang: mapToApiLang(lang),
    requestHeaders,
  };
}

export default async function Page() {
  const queryClient = createServerQueryClient();
  const { lang, requestHeaders } = await getPredictionLocaleContext();
  const client = getServerPredictClient({ headers: requestHeaders });

  // Mirror the client EventsPage default: when Kalshi is disabled the list is
  // pinned to Polymarket, so the SSR prefetch must use the same `source` to
  // keep the query key aligned and avoid a redundant client refetch.
  const params = resolveEventsParams({
    sort_by: "volume",
    sort_asc: false,
    ...(lang ? { lang } : {}),
    ...(ENABLE_KALSHI ? {} : { source: "polymarket" as const }),
  });

  await Promise.race([
    queryClient.prefetchInfiniteQuery({
      queryKey: infiniteEventsQueryKey(params),
      queryFn: ({ pageParam }) =>
        fetchEventsPage(client, {
          ...params,
          ...(pageParam ? { cursor: pageParam } : {}),
        }).then(filterTradableEventsPage),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage: {
        has_more?: boolean;
        next_cursor?: string;
      }) =>
        lastPage.has_more && lastPage.next_cursor
          ? lastPage.next_cursor
          : undefined,
      pages: 1,
    }),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("prefetch timeout")), 3000),
    ),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PredictListPage />
    </HydrationBoundary>
  );
}
