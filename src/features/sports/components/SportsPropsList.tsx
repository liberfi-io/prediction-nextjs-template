"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "@liberfi.io/i18n";
import type {
  SportsInlineMarket,
  SportsMarketOutcome,
  SportsPage,
  SportsPropEventCard,
} from "../types";
import { formatVolume } from "../../worldcup/components/util";
import {
  convertPrice,
  type OddsFormat,
} from "../../worldcup/odds/convert-price";
import { OddsNumber } from "../../worldcup/odds/OddsNumber";
import { useOddsFormat } from "../../worldcup/odds/OddsFormatProvider";
import { SportsEmptyState } from "./SportsEmptyState";
import { SportsPropsGrid } from "./SportsPropsGrid";
import { sportsOutcomePrice } from "./sportsOutcomePrice";

const DISPLAYED_MARKET_COUNT = 3;

/** Renders the independently styled sports props event-card list. */
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
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const canLoadMore = page.has_more && Boolean(page.next_cursor);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !canLoadMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canLoadMore, loading, onLoadMore]);

  if (page.items.length === 0) {
    return <SportsEmptyState label={t("extend.sports.empty.props")} />;
  }

  return (
    <SportsPropsGrid className="pb-4">
      <div className="sports-props-card-grid grid">
        {page.items.map((event) => (
          <div key={event.event_slug} className="p-2">
            <SportsPropCard event={event} />
          </div>
        ))}
      </div>
      <div ref={loadMoreRef} className="flex h-8 items-center justify-center">
        {loading && (
          <span
            aria-label={t("extend.leaderboard.loading")}
            className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300"
            role="status"
          />
        )}
      </div>
    </SportsPropsGrid>
  );
}

function SportsPropCard({ event }: { event: SportsPropEventCard }) {
  const { t } = useTranslation();
  const [format] = useOddsFormat();
  const markets = useMemo(
    () =>
      [...(event.markets ?? [])].sort(
        (left, right) => marketPrice(right) - marketPrice(left),
      ),
    [event.markets],
  );
  const displayedMarkets = markets.slice(0, DISPLAYED_MARKET_COUNT);
  const moreCount = Math.max(0, markets.length - displayedMarkets.length);

  return (
    <Link
      href={`/event/${encodeURIComponent(event.event_slug)}`}
      prefetch={false}
      data-testid="sports-prop-card"
      className="group flex h-full min-h-[248px] flex-col overflow-hidden rounded-[14px] border border-[rgba(39,39,42,0.65)] bg-[rgba(24,24,27,0.4)] transition-[border-color,background-color,box-shadow] duration-300 ease-out hover:border-[rgba(63,63,70,0.55)] hover:bg-[rgba(24,24,27,0.46)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] motion-reduce:transition-none"
    >
      <div className="flex flex-1 flex-col gap-3 p-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <SportsPropImage event={event} />
          <h2 className="min-w-0 text-sm font-semibold leading-snug text-zinc-100 line-clamp-2 sm:text-base">
            {event.title}
          </h2>
        </div>

        {markets.length === 1 ? (
          <div className="mt-auto grid grid-cols-2 gap-2">
            {(markets[0].outcomes ?? []).slice(0, 2).map((outcome) => (
              <div
                key={`${markets[0].market_slug}:${outcome.outcome}`}
                className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-zinc-800/55 px-3 py-2.5"
              >
                <span className="truncate text-xs font-medium text-zinc-300">
                  {outcome.label}
                </span>
                <SportsPropOdds outcome={outcome} format={format} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-1">
            {displayedMarkets.map((market) => (
              <div
                key={market.market_slug}
                className="flex min-h-9 items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors group-hover:bg-zinc-800/25"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-300 sm:text-sm">
                  {market.label}
                </span>
                <SportsPropOdds
                  outcome={affirmativeOutcome(market)}
                  format={format}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-h-9 items-center justify-between gap-3 border-t border-zinc-800/50 bg-zinc-800/15 px-3.5 py-2 text-[10px] text-zinc-500 sm:text-xs">
        <span>{moreCount > 0 ? `+${moreCount}` : ""}</span>
        <span className="tabular-nums">
          {formatVolume(event.volume ?? 0)} {t("extend.worldcup.volume")}
        </span>
      </div>
    </Link>
  );
}

function SportsPropImage({ event }: { event: SportsPropEventCard }) {
  const [failed, setFailed] = useState(false);
  if (!event.image_url || failed) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-semibold text-zinc-400 sm:h-12 sm:w-12">
        {event.title.trim().slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <Image
      src={event.image_url}
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
      unoptimized
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-lg object-cover sm:h-12 sm:w-12"
    />
  );
}

function SportsPropOdds({
  outcome,
  format,
}: {
  outcome?: SportsMarketOutcome;
  format: OddsFormat;
}) {
  const price = sportsOutcomePrice(outcome);
  return (
    <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-100">
      {price === undefined ? (
        "-"
      ) : (
        <OddsNumber value={convertPrice(price, format)} variant="fade" />
      )}
    </span>
  );
}

function affirmativeOutcome(
  market: SportsInlineMarket,
): SportsMarketOutcome | undefined {
  return (
    market.outcomes?.find((outcome) => outcome.outcome === "yes") ??
    market.outcomes?.[0]
  );
}

function marketPrice(market: SportsInlineMarket): number {
  return sportsOutcomePrice(affirmativeOutcome(market)) ?? 0;
}
