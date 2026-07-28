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

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SportsPageSearchParams>;
}) {
  const flags = resolveSportsFeatureFlags(process.env);
  if (!flags.esports_enabled) notFound();

  const filters = resolveSportsPageFilters(await searchParams);
  const { lang, requestHeaders } = await getPredictionLocaleContext();
  const data = await prefetchSportsPageData({
    section: "esports",
    lang,
    requestHeaders,
    deadline: createSportsSsrDeadline(3000),
    filters,
  });

  return (
    <SportsShell
      section="esports"
      data={data}
      filters={filters}
      lang={lang}
      marketDataCapability={MARKET_DATA_FEATURE_CAPABILITY}
    />
  );
}
