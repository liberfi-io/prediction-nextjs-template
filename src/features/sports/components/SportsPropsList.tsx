"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "@liberfi.io/i18n";
import type { PredictEvent, PredictMarket } from "@liberfi.io/react-predict";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "@liberfi.io/ui";
import {
  PREDICT_TRADE_MODAL_ID,
  PredictTradeModal,
  type PredictTradeModalParams,
} from "@liberfi.io/ui-predict";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
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
import {
  SPORTS_CARD_INTERACTION_CLASS,
  SPORTS_CARD_SURFACE_CLASS,
} from "./sportsCardSurface";
import {
  SPORTS_PROPS_DESKTOP_COLUMNS,
  SPORTS_PROPS_MOBILE_MEDIA_QUERY,
  SportsPropsGrid,
} from "./SportsPropsGrid";
import { sportsOutcomePrice } from "./sportsOutcomePrice";

const DISPLAYED_MARKET_COUNT = 3;
const ESTIMATED_PROPS_ROW_HEIGHT = 264;

/** Renders the independently evolved sports props event-card list. */
export function SportsPropsList({
  page,
  loading,
  onLoadMore,
  getScrollElement,
}: {
  page: SportsPage<SportsPropEventCard>;
  loading: boolean;
  onLoadMore: () => void;
  getScrollElement: () => HTMLElement | null;
}) {
  const { t } = useTranslation();
  const canLoadMore = page.has_more && Boolean(page.next_cursor);
  const cardsPerRow = usePropsCardsPerRow();
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const rows = useMemo(
    () =>
      Array.from(
        { length: Math.ceil(page.items.length / cardsPerRow) },
        (_, index) =>
          page.items.slice(
            index * cardsPerRow,
            (index + 1) * cardsPerRow,
          ),
      ),
    [cardsPerRow, page.items],
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement,
    estimateSize: () => ESTIMATED_PROPS_ROW_HEIGHT,
    getItemKey: (index) => rows[index]?.[0]?.event_slug ?? index,
    overscan: 3,
    scrollMargin,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const { onOpen: openTradeModal } =
    useAsyncModal<PredictTradeModalParams>(PREDICT_TRADE_MODAL_ID);
  const handleSelectOutcome = useCallback(
    (
      event: SportsPropEventCard,
      market: SportsInlineMarket,
      side: "yes" | "no",
    ) => {
      openTradeModal({
        params: {
          event: toPredictEvent(event),
          market: toPredictMarket(event, market),
          initialOutcome: side,
        },
      });
    },
    [openTradeModal],
  );

  useLayoutEffect(() => {
    const list = listRef.current;
    const scroll = getScrollElement();
    if (!list || !scroll) return;
    const nextMargin =
      list.getBoundingClientRect().top -
      scroll.getBoundingClientRect().top +
      scroll.scrollTop;
    setScrollMargin((current) =>
      current === nextMargin ? current : nextMargin,
    );
  });

  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (
      canLoadMore &&
      !loading &&
      (rows.length === 0 || (last && last.index >= rows.length - 2))
    ) {
      onLoadMore();
    }
  }, [canLoadMore, loading, onLoadMore, rows.length, virtualItems]);

  if (page.items.length === 0) {
    return <SportsEmptyState label={t("extend.sports.empty.props")} />;
  }

  return (
    <SportsPropsGrid className="pb-4">
      <div
        ref={listRef}
        data-testid="sports-props-virtual-list"
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualItems.map((item) => (
          <div
            key={item.key}
            ref={virtualizer.measureElement}
            data-index={item.index}
            className="absolute left-0 top-0 w-full"
            style={{
              transform: `translateY(${item.start - scrollMargin}px)`,
            }}
          >
            <div className="sports-props-card-grid grid">
              {rows[item.index]?.map((event) => (
                <div key={event.event_slug} className="p-2">
                  <SportsPropCard
                    event={event}
                    onSelectOutcome={handleSelectOutcome}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .sports-prop-card button:focus-visible,
        .sports-prop-card a:focus-visible {
          outline: 2px solid hsl(var(--heroui-primary) / 0.4);
          outline-offset: 2px;
        }
      `}</style>
      <div className="flex h-8 items-center justify-center">
        {loading && (
          <span
            aria-label={t("extend.leaderboard.loading")}
            className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300"
            role="status"
          />
        )}
      </div>
      <PredictTradeModal />
    </SportsPropsGrid>
  );
}

function SportsPropCard({
  event,
  onSelectOutcome,
}: {
  event: SportsPropEventCard;
  onSelectOutcome: (
    event: SportsPropEventCard,
    market: SportsInlineMarket,
    side: "yes" | "no",
  ) => void;
}) {
  const { t } = useTranslation();
  const [format] = useOddsFormat();
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const markets = useMemo(
    () =>
      [...(event.markets ?? [])]
        .filter(isOpenSportsMarket)
        .sort((left, right) => marketPrice(right) - marketPrice(left)),
    [event.markets],
  );
  const displayedMarkets = markets.slice(0, DISPLAYED_MARKET_COUNT);
  const moreCount = Math.max(0, markets.length - displayedMarkets.length);
  const singleMarket = markets.length === 1;
  const expandedMarket = expandedSlug
    ? markets.find((market) => market.market_slug === expandedSlug)
    : undefined;
  const activeMarket = singleMarket ? markets[0] : expandedMarket;

  return (
    <article
      data-testid="sports-prop-card"
      className={`sports-prop-card group flex h-full min-h-[248px] flex-col ${SPORTS_CARD_SURFACE_CLASS} ${SPORTS_CARD_INTERACTION_CLASS}`}
    >
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <CardHeader
          event={event}
          expanded={Boolean(expandedMarket)}
          onCollapse={() => setExpandedSlug(null)}
        />

        <div className="flex flex-1 flex-col">
          {activeMarket ? (
            <ActiveMarketBody
              market={activeMarket}
              format={format}
              collapsible={!singleMarket}
              onCollapse={() => setExpandedSlug(null)}
              onSelectOutcome={(market, side) =>
                onSelectOutcome(event, market, side)
              }
            />
          ) : (
            <MarketListBody
              markets={displayedMarkets}
              format={format}
              onMarketClick={(market) => setExpandedSlug(market.market_slug)}
            />
          )}
        </div>
      </div>

      <CardFooter>
        {activeMarket && !singleMarket ? (
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 text-[10px] text-zinc-500 transition-colors hover:text-slate-200 lg:text-xs"
            onClick={() => setExpandedSlug(null)}
          >
            <ChevronLeftIcon className="h-3 w-3" />
            {t("predict.event.back")}
          </button>
        ) : (
          <Link
            href={`/event/${encodeURIComponent(event.event_slug)}`}
            prefetch={false}
            className="flex items-center gap-1 text-[10px] text-zinc-500 transition-colors hover:text-slate-200 lg:text-xs"
          >
            {singleMarket
              ? t("predict.event.viewEvent")
              : moreCount > 0
                ? t("predict.event.showMore")
                : ""}
            {(singleMarket || moreCount > 0) && (
              <ChevronRightIcon className="h-3 w-3" />
            )}
          </Link>
        )}
        <span className="text-[10px] tabular-nums text-zinc-500 lg:text-xs">
          {formatVolume(event.volume ?? 0)} {t("predict.event.volume")}
        </span>
      </CardFooter>
    </article>
  );
}

function usePropsCardsPerRow(): number {
  const [cardsPerRow, setCardsPerRow] = useState(
    SPORTS_PROPS_DESKTOP_COLUMNS,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(SPORTS_PROPS_MOBILE_MEDIA_QUERY);
    const update = () =>
      setCardsPerRow(media.matches ? 1 : SPORTS_PROPS_DESKTOP_COLUMNS);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return cardsPerRow;
}

function CardHeader({
  event,
  expanded,
  onCollapse,
}: {
  event: SportsPropEventCard;
  expanded: boolean;
  onCollapse: () => void;
}) {
  const content = (
    <>
      <SportsPropImage event={event} />
      <h2 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-200 line-clamp-2 sm:text-base">
        {event.title}
      </h2>
    </>
  );

  return expanded ? (
    <button
      type="button"
      className="flex w-full cursor-pointer items-center gap-3 text-left"
      onClick={onCollapse}
    >
      {content}
    </button>
  ) : (
    <Link
      href={`/event/${encodeURIComponent(event.event_slug)}`}
      prefetch={false}
      className="flex w-full items-center gap-3 text-left"
    >
      {content}
    </Link>
  );
}

function MarketListBody({
  markets,
  format,
  onMarketClick,
}: {
  markets: SportsInlineMarket[];
  format: OddsFormat;
  onMarketClick: (market: SportsInlineMarket) => void;
}) {
  return (
    <div className="flex w-full flex-1 flex-col gap-y-0.5 lg:gap-y-2">
      {markets.map((market) => (
        <button
          type="button"
          key={market.market_slug}
          className="flex h-9 w-full items-center justify-between gap-2 transition-opacity hover:cursor-pointer hover:opacity-80"
          onClick={() => onMarketClick(market)}
        >
          <span className="min-w-0 flex-1 text-left text-xs text-slate-200 line-clamp-1 lg:text-sm">
            {market.label}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <SportsPropOdds
              outcome={findOutcome(market, "yes")}
              format={format}
              className="text-sm font-semibold text-slate-200 lg:text-lg"
            />
            <YesNoPill />
          </div>
        </button>
      ))}
    </div>
  );
}

function ActiveMarketBody({
  market,
  format,
  collapsible,
  onCollapse,
  onSelectOutcome,
}: {
  market: SportsInlineMarket;
  format: OddsFormat;
  collapsible: boolean;
  onCollapse: () => void;
  onSelectOutcome: (market: SportsInlineMarket, side: "yes" | "no") => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      {collapsible && (
        <button
          type="button"
          className="flex h-9 w-full cursor-pointer items-center justify-between gap-2"
          onClick={onCollapse}
        >
          <span className="min-w-0 flex-1 text-left text-xs text-slate-200 lg:text-sm">
            {market.label}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <SportsPropOdds
              outcome={findOutcome(market, "yes")}
              format={format}
              className="text-sm font-semibold text-slate-200 lg:text-lg"
            />
            <ChevronUpIcon className="h-4 w-4 text-neutral-400" />
          </div>
        </button>
      )}
      <div className={collapsible ? "mt-3" : ""}>
        <OutcomeButtons
          market={market}
          format={format}
          onSelectOutcome={onSelectOutcome}
        />
      </div>
    </div>
  );
}

function OutcomeButtons({
  market,
  format,
  onSelectOutcome,
}: {
  market: SportsInlineMarket;
  format: OddsFormat;
  onSelectOutcome: (market: SportsInlineMarket, side: "yes" | "no") => void;
}) {
  const { t } = useTranslation();
  const outcomes = (["yes", "no"] as const).map((side) => ({
    side,
    outcome: findOutcome(market, side),
  }));

  return (
    <div className="flex gap-2">
      {outcomes.map(({ side, outcome }) => (
        <ElevatedButton
          key={side}
          side={side}
          onClick={() => onSelectOutcome(market, side)}
        >
          <span className="truncate">
            {outcomeButtonLabel(
              outcome,
              side,
              t("predict.market.yes"),
              t("predict.market.no"),
            )}
          </span>
          <SportsPropOdds
            outcome={outcome}
            format={format}
            className="shrink-0 font-normal text-inherit"
          />
        </ElevatedButton>
      ))}
    </div>
  );
}

function outcomeButtonLabel(
  outcome: SportsMarketOutcome | undefined,
  side: "yes" | "no",
  yesLabel: string,
  noLabel: string,
): string {
  const label = outcome?.label?.trim();
  if (!label || label.toLowerCase() === "yes" || label.toLowerCase() === "no") {
    return side === "yes" ? yesLabel : noLabel;
  }
  return label;
}

function ElevatedButton({
  side,
  onClick,
  children,
}: {
  side: "yes" | "no";
  onClick: () => void;
  children: ReactNode;
}) {
  const colors =
    side === "yes"
      ? {
          background: "hsl(var(--heroui-primary) / 0.14)",
          text: "hsl(var(--heroui-primary))",
          shadow: "hsl(var(--heroui-primary) / 0.18)",
        }
      : {
          background: "hsl(var(--heroui-secondary) / 0.14)",
          text: "hsl(var(--heroui-secondary))",
          shadow: "hsl(var(--heroui-secondary) / 0.18)",
        };

  const handleEnter = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.setProperty("--shadow-offset", "2px");
    event.currentTarget.style.transform = "translateY(2px)";
  };
  const handleLeave = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.setProperty("--shadow-offset", "4px");
    event.currentTarget.style.transform = "translateY(0)";
  };

  return (
    <button
      type="button"
      className="flex h-12 min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-lg p-3 text-base font-normal will-change-transform hover:cursor-pointer [-webkit-tap-highlight-color:transparent]"
      style={
        {
          backgroundColor: colors.background,
          color: colors.text,
          "--shadow-offset": "4px",
          boxShadow: `inset 0 -1px 0 rgba(255,255,255,0.08), 0 var(--shadow-offset) 0 ${colors.shadow}`,
          transition: "transform .12s, box-shadow .12s, opacity .14s",
        } as CSSProperties
      }
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function YesNoPill() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex h-7 w-[85px] shrink-0 items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-primary/15 to-secondary/15 p-1.5 text-xs font-semibold lg:h-9 lg:w-24 lg:gap-4 lg:p-2 lg:text-sm">
      <span className="text-primary">{t("predict.market.yes")}</span>
      <span className="text-neutral-400">/</span>
      <span className="text-secondary">{t("predict.market.no")}</span>
    </span>
  );
}

function CardFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="mt-auto flex min-h-9 items-center justify-between gap-3 border-t border-zinc-800/50 bg-zinc-800/15 px-3.5 py-2">
      {children}
    </footer>
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
      className="h-10 w-10 shrink-0 rounded-lg object-cover transition-transform duration-300 group-hover:scale-110 sm:h-12 sm:w-12"
    />
  );
}

function SportsPropOdds({
  outcome,
  format,
  className,
}: {
  outcome?: SportsMarketOutcome;
  format: OddsFormat;
  className: string;
}) {
  const price = sportsOutcomePrice(outcome);
  return (
    <span className={`tabular-nums ${className}`}>
      {price === undefined ? (
        "-"
      ) : (
        <OddsNumber value={convertPrice(price, format)} variant="roll" />
      )}
    </span>
  );
}

function findOutcome(
  market: SportsInlineMarket,
  side: "yes" | "no",
): SportsMarketOutcome | undefined {
  return market.outcomes?.find((outcome) => outcome.outcome === side);
}

function marketPrice(market: SportsInlineMarket): number {
  return sportsOutcomePrice(findOutcome(market, "yes")) ?? 0;
}

function isOpenSportsMarket(market: SportsInlineMarket): boolean {
  return market.status === undefined || market.status === "open";
}

function toPredictEvent(event: SportsPropEventCard): PredictEvent {
  return {
    slug: event.event_slug,
    title: event.title,
    image_url: event.image_url,
    volume: event.volume,
    status: predictStatus(event.status),
    start_at: event.start_time,
    source: "polymarket",
  };
}

function toPredictMarket(
  event: SportsPropEventCard,
  market: SportsInlineMarket,
): PredictMarket {
  return {
    slug: market.market_slug,
    event_slug: event.event_slug,
    question: market.label,
    status: predictStatus(market.status ?? event.status),
    source: "polymarket",
    provider_meta: market.provider_meta,
    outcomes: (["yes", "no"] as const).map((side) => {
      const outcome = findOutcome(market, side);
      return {
        label: outcome?.label ?? side,
        price: outcome?.price,
        best_bid: outcome?.best_bid,
        best_ask: outcome?.best_ask,
      };
    }),
  };
}

function predictStatus(
  status?: string,
): "pending" | "open" | "closed" | "voided" {
  if (
    status === "pending" ||
    status === "closed" ||
    status === "voided"
  ) {
    return status;
  }
  return "open";
}
