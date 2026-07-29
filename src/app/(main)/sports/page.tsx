import { notFound } from "next/navigation";
import { SportsShell } from "src/features/sports/components/SportsShell";
import { prefetchSportsPageData } from "src/features/sports/api/prefetch";
import {
  resolveSportsPageFilters,
  type SportsPageSearchParams,
} from "src/features/sports/route/pageFilters";
import { createSportsSsrDeadline } from "src/features/sports/route/sportsSsrDeadline";
import { getPredictionLocaleContext } from "src/i18n/predictionLocaleContext";
import {
  MARKET_DATA_FEATURE_CAPABILITY,
  resolveSportsFeatureFlags,
} from "src/libs/featureFlags";
import { getSportsMarketDataHydration } from "src/features/market-data/server";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SportsPageSearchParams>;
}) {
  const flags = resolveSportsFeatureFlags(process.env);
  if (!flags.sports_enabled) notFound();

  const filters = resolveSportsPageFilters(await searchParams);
  const { lang, requestHeaders } = await getPredictionLocaleContext();
  const deadline = createSportsSsrDeadline(3000);
  const marketDataHydrationPromise = MARKET_DATA_FEATURE_CAPABILITY.enabled
    ? deadline
        .withRemainingTimeout(() =>
          getSportsMarketDataHydration({
            enabled: true,
            section: "sports",
            filters,
            lang,
            requestHeaders,
          }),
        )
        .catch(() => undefined)
    : Promise.resolve(undefined);
  const dataPromise = prefetchSportsPageData({
    section: "sports",
    lang,
    requestHeaders,
    deadline,
    filters,
  });
  const [marketDataHydration, data] = await Promise.all([
    marketDataHydrationPromise,
    dataPromise,
  ]);
  const hydratedData = {
    ...data,
    ...(marketDataHydration?.pages.matches
      ? {
          matches: marketDataHydration.pages.matches.items,
          match_pagination: {
            next_cursor: marketDataHydration.pages.matches.next_cursor,
            has_more: marketDataHydration.pages.matches.has_more,
            limit: marketDataHydration.pages.matches.limit,
          },
        }
      : {}),
    ...(marketDataHydration?.pages.props
      ? {
          props: marketDataHydration.pages.props.items,
          prop_pagination: {
            next_cursor: marketDataHydration.pages.props.next_cursor,
            has_more: marketDataHydration.pages.props.has_more,
            limit: marketDataHydration.pages.props.limit,
          },
        }
      : {}),
  };

  return (
    <SportsShell
      section="sports"
      data={hydratedData}
      filters={filters}
      lang={lang}
      marketDataCapability={MARKET_DATA_FEATURE_CAPABILITY}
      marketDataResources={marketDataHydration?.resources}
    />
  );
}
