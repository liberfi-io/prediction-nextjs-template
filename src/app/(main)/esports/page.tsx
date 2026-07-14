import { notFound } from "next/navigation";
import { SportsShell } from "src/features/sports/components/SportsShell";
import { prefetchSportsPageData } from "src/features/sports/api/prefetch";
import { createSportsSsrDeadline } from "src/features/sports/route/sportsSsrDeadline";
import { getPredictionLocaleContext } from "src/i18n/predictionLocaleContext";
import { resolveSportsFeatureFlags } from "src/libs/featureFlags";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = resolveSportsFeatureFlags(process.env);
  if (!flags.esports_enabled) notFound();

  const { lang, requestHeaders } = await getPredictionLocaleContext();
  const data = await prefetchSportsPageData({
    section: "esports",
    lang,
    requestHeaders,
    deadline: createSportsSsrDeadline(3000),
  });

  return <SportsShell section="esports" data={data} />;
}
