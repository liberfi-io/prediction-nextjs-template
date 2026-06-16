"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { cn } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import {
  useRealtimeOrderbook,
  usePredictClient,
  orderbookQueryKey,
  pickBestAsk,
} from "@liberfi.io/react-predict";
import { convertPrice } from "../../odds/convert-price";
import { useOddsFormat } from "../../odds/OddsFormatProvider";
import { formatVolume } from "../util";
import {
  type CategorizedMarkets,
  type MarketCategory,
  type MarketGroup,
  type MarketOption,
  findSelection,
  yesPrice,
  yesAskPrice,
} from "./marketGrouping";

type SortKey = "default" | "odds" | "volume" | "liquidity";

const SORTS: SortKey[] = ["default", "odds", "volume", "liquidity"];

/**
 * future.news-style Markets switcher. Lets the user browse every market type of
 * a match, filter to active markets, re-sort, and pick a specific outcome/line
 * — which drives the chart, order book, trade panel and header of the detail
 * page.
 */
export function MarketsPanel({
  cats,
  activeCategory,
  selectedSlug,
  onSelect,
  className,
}: {
  cats: CategorizedMarkets;
  activeCategory: MarketCategory;
  selectedSlug: string;
  onSelect: (slug: string) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const predictClient = usePredictClient();

  const [sort, setSort] = useState<SortKey>("default");
  const [activeOnly, setActiveOnly] = useState(false);
  const [category, setCategory] = useState<MarketCategory>(activeCategory);

  // The selected market also has a live order book on screen; subscribe to its
  // YES book so the panel's displayed price for that market tracks the order
  // book's best ask in real time (the 30s event poll only refreshes the static
  // snapshot, which drifts from the live WS book).
  const selectedMarket = useMemo(
    () =>
      selectedSlug
        ? findSelection(cats, selectedSlug)?.option.market
        : undefined,
    [cats, selectedSlug],
  );
  const { data: liveOrderbook } = useRealtimeOrderbook(
    {
      slug: selectedMarket?.slug ?? "",
      source: selectedMarket?.source ?? "polymarket",
      outcome: "yes",
    },
    { enabled: Boolean(selectedMarket) && selectedMarket?.status === "open" },
  );
  const liveSelectedPrice = useMemo(() => {
    if (
      !selectedMarket ||
      liveOrderbook?.market_id !== selectedMarket.slug ||
      liveOrderbook?.outcome !== "yes"
    ) {
      return null;
    }
    const ask = pickBestAsk(liveOrderbook, "yes");
    return ask != null && ask > 0 ? ask : null;
  }, [liveOrderbook, selectedMarket]);

  const categoryTabs = useMemo(
    () =>
      (
        [
          ["gameLines", cats.gameLines],
          ["exactScore", cats.exactScore],
          ["halftime", cats.halftime],
          ["secondHalf", cats.secondHalf],
          ["corners", cats.corners],
          ["goals", cats.goals],
          ["assists", cats.assists],
          ["shots", cats.shots],
          ["saves", cats.saves],
          ["other", cats.other],
        ] as [MarketCategory, MarketGroup[]][]
      ).filter(([, groups]) => groups.length > 0),
    [cats],
  );

  const groups = useMemo<MarketGroup[]>(() => cats[category], [cats, category]);
  const visibleMarkets = useMemo(() => {
    const bySlug = new Map<string, MarketOption["market"]>();
    for (const group of groups) {
      for (const option of group.options) {
        if (activeOnly && option.market.status !== "open") continue;
        bySlug.set(option.market.slug, option.market);
      }
    }
    return [...bySlug.values()];
  }, [activeOnly, groups]);
  const visibleOrderbooks = useQueries({
    queries: visibleMarkets.map((market) => ({
      queryKey: orderbookQueryKey(
        market.slug,
        market.source ?? "polymarket",
        "yes",
      ),
      queryFn: () =>
        predictClient.getOrderbook(
          market.slug,
          market.source ?? "polymarket",
          "yes",
        ),
      enabled: market.status === "open",
      refetchInterval: 5_000,
      staleTime: 1_000,
    })),
  });
  const orderbookPricesBySlug = useMemo(() => {
    const prices = new Map<string, number>();
    visibleOrderbooks.forEach((result, index) => {
      const market = visibleMarkets[index];
      const orderbook = result.data;
      if (!market || orderbook?.market_id !== market.slug) return;
      if (orderbook.outcome !== "yes") return;
      const ask = pickBestAsk(orderbook, "yes");
      if (ask != null && ask > 0) prices.set(market.slug, ask);
    });
    return prices;
  }, [visibleMarkets, visibleOrderbooks]);

  const sortOptions = (options: MarketOption[]): MarketOption[] => {
    const filtered = activeOnly
      ? options.filter((o) => o.market.status === "open")
      : options;
    if (sort === "default") return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sort) {
        case "odds":
          return yesPrice(b.market) - yesPrice(a.market);
        case "volume":
          return (b.market.volume ?? 0) - (a.market.volume ?? 0);
        case "liquidity":
          return (b.market.liquidity ?? 0) - (a.market.liquidity ?? 0);
        default:
          return 0;
      }
    });
    return copy;
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-[12px] border border-zinc-800 bg-zinc-900/40",
        className,
      )}
    >
      {/* Sort + active-only */}
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 px-3 py-2">
        {SORTS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={cn(
              "rounded-[7px] px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
              sort === key
                ? "bg-zinc-800 text-[#c7ff2e]"
                : "text-zinc-500 hover:text-zinc-200",
            )}
          >
            {t(`extend.worldcup.detail.markets.sort.${key}`)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setActiveOnly((v) => !v)}
          className={cn(
            "ml-auto rounded-[7px] border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
            activeOnly
              ? "border-[#c7ff2e]/50 bg-[#c7ff2e]/10 text-[#c7ff2e]"
              : "border-zinc-700/60 text-zinc-400 hover:text-zinc-200",
          )}
        >
          {t("extend.worldcup.detail.markets.activeOnly")}
        </button>
      </div>

      {/* Category tabs */}
      {categoryTabs.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categoryTabs.map(([key]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                "shrink-0 rounded-[8px] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                category === key
                  ? "bg-zinc-800 text-[#c7ff2e]"
                  : "text-zinc-500 hover:text-zinc-200",
              )}
            >
              {t(`extend.worldcup.detail.markets.category.${key}`)}
            </button>
          ))}
        </div>
      )}

      {/* Groups */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5 [scrollbar-width:thin]">
        {groups.map((group) => (
          <GroupRow
            key={group.key}
            group={group}
            options={sortOptions(group.options)}
            selectedSlug={selectedSlug}
            liveSelectedPrice={liveSelectedPrice}
            orderbookPricesBySlug={orderbookPricesBySlug}
            onSelect={onSelect}
            label={t(`extend.worldcup.detail.markets.type.${group.type_label}`)}
          />
        ))}
      </div>
    </div>
  );
}

function GroupRow({
  group,
  options,
  selectedSlug,
  liveSelectedPrice,
  orderbookPricesBySlug,
  onSelect,
  label,
}: {
  group: MarketGroup;
  options: MarketOption[];
  selectedSlug: string;
  /** Live YES best-ask (0–1) for the currently selected market, if any. */
  liveSelectedPrice: number | null;
  orderbookPricesBySlug: Map<string, number>;
  onSelect: (slug: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const [format] = useOddsFormat();

  if (options.length === 0) return null;

  // Option odds use each market's YES best-ask, so they line up with the order
  // book. For the active market that also drives the on-screen order book,
  // prefer its live best ask.
  const active =
    options.find((o) => o.market.slug === selectedSlug) ?? options[0];
  const priceForMarket = (market: MarketOption["market"]): number =>
    market.slug === selectedSlug && liveSelectedPrice != null
      ? liveSelectedPrice
      : orderbookPricesBySlug.get(market.slug) ?? yesAskPrice(market);
  const odds = convertPrice(priceForMarket(active.market), format);
  const single = options.length === 1;
  const optionOdds = (option: MarketOption): string => {
    return convertPrice(priceForMarket(option.market), format);
  };

  return (
    <div className="rounded-[10px] border border-zinc-800/70 bg-zinc-900/40 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-medium text-zinc-100">
            {label}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
            {formatVolume(group.volume)} {t("extend.worldcup.volume")}
          </span>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-[#c7ff2e]">
          {odds}
        </span>
      </div>

      {single ? (
        <button
          type="button"
          onClick={() => onSelect(options[0].market.slug)}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-[8px] border px-2.5 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer",
            options[0].market.slug === selectedSlug
              ? "border-[#c7ff2e]/60 bg-[#c7ff2e]/10 text-[#c7ff2e]"
              : "border-zinc-700/60 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100",
          )}
        >
          <span className="min-w-0 truncate">{options[0].label}</span>
          <span
            className={cn(
              "shrink-0 text-[10px] font-semibold tabular-nums",
              options[0].market.slug === selectedSlug
                ? "text-[#c7ff2e]/70"
                : "text-zinc-500",
            )}
          >
            {optionOdds(options[0])}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {options.map((o) => {
            const selected = o.market.slug === selectedSlug;
            return (
              <button
                key={o.market.slug}
                type="button"
                onClick={() => onSelect(o.market.slug)}
                className={cn(
                  "flex shrink-0 items-baseline gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors cursor-pointer",
                  selected
                    ? "border-[#c7ff2e]/60 bg-[#c7ff2e]/10 text-[#c7ff2e]"
                    : "border-zinc-700/60 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100",
                )}
              >
                <span>{o.label}</span>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    selected ? "text-[#c7ff2e]/70" : "text-zinc-500",
                  )}
                >
                  {optionOdds(o)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
