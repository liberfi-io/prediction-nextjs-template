"use client";

import * as React from "react";
import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LinkComponentType } from "@liberfi.io/ui";
import { MatchesPage as MatchesPageRaw } from "@liberfi.io/ui-predict";

/**
 * Forward-compat — published `@liberfi.io/ui-predict` typings may not yet
 * expose the v1.1 `onSelectMatch` / `getMatchHref` props nor the v1.2
 * per-leg `onSelectLeg` / `getLegHref` props. We widen the props here so
 * this template builds against both the old (npm) and new (local link)
 * SDK versions during the rollout window. The runtime component already
 * accepts these props in v1.2.
 */
const MatchesPage = MatchesPageRaw as unknown as React.ComponentType<
  React.ComponentProps<typeof MatchesPageRaw> & {
    onSelectMatch?: (match: MatchMarketFlat) => void;
    getMatchHref?: (match: MatchMarketFlat) => string | undefined;
    onSelectLeg?: (match: MatchMarketFlat, leg: MatchLegLite) => void;
    getLegHref?: (
      match: MatchMarketFlat,
      leg: MatchLegLite,
    ) => string | undefined;
  }
>;
import type {
  MatchMarketFlat,
  ProviderSource,
} from "@liberfi.io/react-predict";
import { predictEventHref } from "./predict-source";

/**
 * v1.1 forward-compat shape — the published `@liberfi.io/react-predict`
 * version may not yet carry `legs` on `MatchMarketFlat`. We read it
 * defensively so this template builds against both the old (npm) and
 * the new (local link) SDK during the rollout window.
 */
interface MatchLegLite {
  source: ProviderSource;
  event_slug?: string;
  best_price?: number;
}
type MatchMarketFlatV11 = MatchMarketFlat & { legs?: MatchLegLite[] };

const NoPrefetchLink: LinkComponentType = (props) => (
  <Link prefetch={false} {...props} />
);

/**
 * Pick the cheaper-YES leg from a match's `legs` array.
 *
 * v1.1 cards no longer expose a "Buy CTA"; the entire card body is the
 * primary action and routes to the cheaper leg's event detail page on
 * our own site (the per-leg external icon handles the platform deep link).
 *
 * Falls back to the deprecated `market_a` / `market_b` shape so the
 * template keeps working against an older prediction-server response
 * during the rollout window.
 */
function pickInternalTarget(rawMatch: MatchMarketFlat): {
  source: ProviderSource;
  slug: string | null;
} | null {
  const match = rawMatch as MatchMarketFlatV11;
  const legs = match.legs ?? [];
  if (legs.length >= 2) {
    const [a, b] = legs;
    const cheaper =
      a.best_price != null &&
      b.best_price != null &&
      b.best_price < a.best_price
        ? b
        : a;
    return {
      source: cheaper.source,
      slug: cheaper.event_slug || null,
    };
  }

  // Legacy fallback (will be removed alongside market_a / market_b).
  const a = match.market_a;
  const b = match.market_b;
  if (a || b) {
    const aPrice = a?.outcomes?.[0]?.price;
    const bPrice = b?.outcomes?.[0]?.price;
    const cheaperIsB = aPrice != null && bPrice != null && bPrice < aPrice;
    return {
      source: cheaperIsB ? match.source_b : match.source_a,
      slug: (cheaperIsB ? b?.event_slug : a?.event_slug) || null,
    };
  }
  return null;
}

function buildInternalHref(match: MatchMarketFlat): string | undefined {
  const target = pickInternalTarget(match);
  if (!target?.slug) return undefined;
  return predictEventHref({ slug: target.slug, source: target.source });
}

function buildLegHref(leg: MatchLegLite): string | undefined {
  if (!leg?.event_slug) return undefined;
  return predictEventHref({ slug: leg.event_slug, source: leg.source });
}

export function PredictMatchesPage() {
  const router = useRouter();

  const handleSelectMatch = useCallback(
    (match: MatchMarketFlat) => {
      const href = buildInternalHref(match);
      if (href) router.push(href);
    },
    [router],
  );

  const getMatchHref = useCallback(
    (match: MatchMarketFlat) => buildInternalHref(match),
    [],
  );

  const handleSelectLeg = useCallback(
    (_match: MatchMarketFlat, leg: MatchLegLite) => {
      const href = buildLegHref(leg);
      if (href) router.push(href);
    },
    [router],
  );

  const getLegHref = useCallback(
    (_match: MatchMarketFlat, leg: MatchLegLite) => buildLegHref(leg),
    [],
  );

  const handleHover = useCallback(
    (match: MatchMarketFlat) => {
      // NoPrefetchLink disables Next's hover prefetch entirely, and the
      // card body links to the cheaper leg while each PlatformRow links
      // to its own platform — so prefetch all three candidate hrefs on
      // card hover. router.prefetch dedupes on the same path, so the
      // cheaper-leg URL counted twice is effectively a single fetch.
      const cheaperHref = buildInternalHref(match);
      if (cheaperHref) router.prefetch(cheaperHref);

      const legs = (match as MatchMarketFlatV11).legs ?? [];
      for (const leg of legs) {
        const legHref = buildLegHref(leg);
        if (legHref && legHref !== cheaperHref) router.prefetch(legHref);
      }
    },
    [router],
  );

  return (
    <MatchesPage
      onSelectMatch={handleSelectMatch}
      getMatchHref={getMatchHref}
      onSelectLeg={handleSelectLeg}
      getLegHref={getLegHref}
      onHover={handleHover}
      LinkComponent={NoPrefetchLink}
      bgImageSrc="/matches-bg-wide.png"
    />
  );
}
