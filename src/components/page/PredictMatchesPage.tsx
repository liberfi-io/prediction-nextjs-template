"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LinkComponentType } from "@liberfi.io/ui";
import { MatchesPage } from "@liberfi.io/ui-predict";
import type {
  MatchMarketFlat,
  ProviderSource,
} from "@liberfi.io/react-predict";
import { toDisplaySource } from "./predict-source";

const NoPrefetchLink: LinkComponentType = (props) => (
  <Link prefetch={false} {...props} />
);

export function PredictMatchesPage() {
  const router = useRouter();

  const handleSelect = useCallback(
    (match: MatchMarketFlat, source: ProviderSource) => {
      const market = source === match.source_a ? match.market_a : match.market_b;
      if (market?.event_slug) {
        router.push(`/${toDisplaySource(source)}/${market.event_slug}`);
      }
    },
    [router],
  );

  const getMarketHref = useCallback(
    (match: MatchMarketFlat, source: ProviderSource) => {
      const market = source === match.source_a ? match.market_a : match.market_b;
      if (market?.event_slug) {
        return `/${toDisplaySource(source)}/${market.event_slug}`;
      }
      return undefined;
    },
    [],
  );

  const handleHover = useCallback(
    (match: MatchMarketFlat) => {
      const hrefA = match.market_a?.event_slug
        ? `/${toDisplaySource(match.source_a)}/${match.market_a.event_slug}`
        : null;
      const hrefB = match.market_b?.event_slug
        ? `/${toDisplaySource(match.source_b)}/${match.market_b.event_slug}`
        : null;
      if (hrefA) router.prefetch(hrefA);
      if (hrefB && hrefB !== hrefA) router.prefetch(hrefB);
    },
    [router],
  );

  return (
    <MatchesPage
      onSelect={handleSelect}
      onHover={handleHover}
      getMarketHref={getMarketHref}
      LinkComponent={NoPrefetchLink}
      bgImageSrc="/matches-bg.webp"
    />
  );
}
