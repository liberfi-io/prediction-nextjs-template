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
import {
  getSportsMarketDataHydration,
  mergeSportsPageDataWithMarketDataHydration,
} from "src/features/market-data/server";

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
  const deadline = createSportsSsrDeadline(5000);
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
  const hydratedData = mergeSportsPageDataWithMarketDataHydration(
    data,
    marketDataHydration,
  );

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
