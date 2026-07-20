"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@liberfi.io/i18n";
import type { LinkComponentType } from "@liberfi.io/ui";
import { EventsUI } from "@liberfi.io/ui-predict";
import type { PredictEvent, PredictMarket } from "@liberfi.io/react-predict";
import type { SportsPage, SportsPropEventCard } from "../types";

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
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
        {t("extend.sports.empty.props")}
      </div>
    );
  }
  return (
    <div className="sports-props-grid -mx-2 pb-4">
      <style>{`
        .sports-props-grid .evt-card-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        @media (max-width: 1023px) {
          .sports-props-grid .evt-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 767px) {
          .sports-props-grid .evt-card-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
      <EventsUI
        events={events}
        hasMore={page.has_more && Boolean(page.next_cursor)}
        isFetchingMore={loading}
        onFetchMore={onLoadMore}
        getEventHref={(event) => `/event/${encodeURIComponent(event.slug)}`}
        LinkComponent={SportsEventLink}
      />
    </div>
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
