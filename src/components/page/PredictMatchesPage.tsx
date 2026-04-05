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
      if (market?.slug) {
        router.push(`/${toDisplaySource(source)}/${market.slug}`);
      }
    },
    [router],
  );

  const getMarketHref = useCallback(
    (match: MatchMarketFlat, source: ProviderSource) => {
      const market = source === match.source_a ? match.market_a : match.market_b;
      if (market?.slug) {
        return `/${toDisplaySource(source)}/${market.slug}`;
      }
      return undefined;
    },
    [],
  );

  return (
    <MatchesPage
      onSelect={handleSelect}
      getMarketHref={getMarketHref}
      LinkComponent={NoPrefetchLink}
      bgImageSrc="/matches-bg.webp"
    />
  );
}
