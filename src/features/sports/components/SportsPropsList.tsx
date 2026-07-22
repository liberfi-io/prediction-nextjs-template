"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@liberfi.io/i18n";
import type { LinkComponentType } from "@liberfi.io/ui";
import { EventsUI } from "@liberfi.io/ui-predict";
import type { PredictEvent, PredictMarket } from "@liberfi.io/react-predict";
import type { SportsPage, SportsPropEventCard } from "../types";
import { SportsEmptyState } from "./SportsEmptyState";
import { SportsPropsGrid } from "./SportsPropsGrid";

const SportsEventLink: LinkComponentType = (props) => (
  <Link prefetch={false} {...props} />
);

export function SportsPropsList({
  page,
  loading,
  onLoadMore,
}: {
  page: SportsPage<SportsPropEventCard>;
  loading: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useTranslation();
  const events = useMemo(
    () => page.items.map(sportsPropToPredictEvent),
    [page.items],
  );
  if (events.length === 0) {
    return <SportsEmptyState label={t("extend.sports.empty.props")} />;
  }
  return (
    <SportsPropsGrid className="pb-4">
      <EventsUI
        events={events}
        hasMore={page.has_more && Boolean(page.next_cursor)}
        isFetchingMore={loading}
        onFetchMore={onLoadMore}
        getEventHref={(event) => `/event/${encodeURIComponent(event.slug)}`}
        LinkComponent={SportsEventLink}
      />
    </SportsPropsGrid>
  );
}

function sportsPropToPredictEvent(event: SportsPropEventCard): PredictEvent {
  const markets: PredictMarket[] = (event.markets ?? []).map((market) => ({
    slug: market.market_slug,
    event_slug: event.event_slug,
    question: market.label,
    status: event.status === "closed" ? "closed" : "open",
    source: "polymarket",
    outcomes: (market.outcomes ?? []).map((outcome) => ({
      label: outcome.label,
      price: outcome.price,
    })),
  }));
  return {
    slug: event.event_slug,
    title: event.title,
    status: event.status === "closed" ? "closed" : "open",
    source: "polymarket",
    markets,
  };
}
