"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import {
  useRealtimeOrderbook,
  usePredictClient,
  usePredictWsClient,
  pickBestAsk,
} from "@liberfi.io/react-predict";
import type {
  Orderbook,
  ProviderSource,
  WsDataMessage,
  WsOrderbookEvent,
} from "@liberfi.io/react-predict";
import { convertPrice } from "../../odds/convert-price";
import { useOddsFormat } from "../../odds/OddsFormatProvider";
import { formatVolume } from "../util";
import {
  type CategorizedMarkets,
  type MarketCategory,
  type MarketGroup,
  type MarketOption,
  allGroups,
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
  // Every open market of the match, across all category tabs. Feeding the whole
  // set to the price hook means switching tabs needs no fresh subscribe/fetch —
  // the prices are already live and seeded.
  const allOpenMarkets = useMemo(() => {
    const bySlug = new Map<string, MarketOption["market"]>();
    for (const group of allGroups(cats)) {
      for (const option of group.options) {
        if (option.market.status === "open") {
          bySlug.set(option.market.slug, option.market);
        }
      }
    }
    return [...bySlug.values()];
  }, [cats]);
  // Markets in the current tab — seeded first so the visible tab fills before
  // the rest stream in behind it.
  const prioritySlugs = useMemo(
    () =>
      new Set(
        visibleMarkets
          .filter((market) => market.status === "open")
          .map((market) => market.slug),
      ),
    [visibleMarkets],
  );
  const orderbookPricesBySlug = useVisibleOrderbookPrices(
    allOpenMarkets,
    selectedMarket?.slug,
    liveSelectedPrice,
    prioritySlugs,
  );

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
            orderbookPricesBySlug={orderbookPricesBySlug}
            onSelect={onSelect}
            label={t(`extend.worldcup.detail.markets.type.${group.type_label}`)}
          />
        ))}
      </div>
    </div>
  );
}

// The batch orderbook endpoint caps a request at 100 markets; chunk so the
// active tab's markets land in the first request.
const SEED_BATCH_SIZE = 100;

/**
 * Tracks the live YES best-ask for every open market of the match.
 *
 * All open markets (across category tabs) are subscribed at once and seeded via
 * REST with bounded concurrency, so switching tabs needs no fresh
 * subscribe/fetch — every market is already live and seeded. The selected
 * market is excluded from the WS subscription (its book is owned by
 * useRealtimeOrderbook / MobileTradeBar on the shared, un-ref-counted client)
 * and instead has its live price mirrored into the map via `selectedPrice`.
 */
function useVisibleOrderbookPrices(
  markets: MarketOption["market"][],
  selectedSlug?: string,
  selectedPrice?: number | null,
  prioritySlugs?: Set<string>,
): Map<string, number> {
  const predictClient = usePredictClient();
  const { wsClient } = usePredictWsClient();
  const [pricesBySlug, setPricesBySlug] = useState<Map<string, number>>(
    () => new Map(),
  );
  // Slugs already covered by a REST snapshot, so the seed only ever fetches a
  // market once.
  const seededSlugsRef = useRef<Set<string>>(new Set());

  // Content-addressed list of (slug, source) pairs to track. Sorting + the JSON
  // round-trip yields a referentially stable value that only changes when the
  // actual set of markets changes, not on every parent re-render.
  const subscribedMarketsKey = useMemo(() => {
    const list = markets
      .filter(
        (market) => market.status === "open" && market.slug !== selectedSlug,
      )
      .map((market) => ({
        slug: market.slug,
        source: (market.source ?? "polymarket") as ProviderSource,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
    return JSON.stringify(list);
  }, [markets, selectedSlug]);
  const subscribedMarkets = useMemo(
    () =>
      JSON.parse(subscribedMarketsKey) as {
        slug: string;
        source: ProviderSource;
      }[],
    [subscribedMarketsKey],
  );
  const subscribedSlugSet = useMemo(
    () => new Set(subscribedMarkets.map((market) => market.slug)),
    [subscribedMarkets],
  );

  // Latest valid-slug set, read by the long-lived WS listener so it does not
  // re-register on every selection/category change.
  const subscribedSlugSetRef = useRef(subscribedSlugSet);
  subscribedSlugSetRef.current = subscribedSlugSet;

  // REST seed: the server pushes no snapshot on subscribe, so fetch one for
  // every not-yet-seeded market to render before the first WS push (and as a
  // fallback when WS is down). A single batch request replaces the previous
  // per-market fan-out; markets in the active tab are placed in the first chunk
  // so they fill immediately while the rest stream in behind them. The seed
  // never overwrites a slug that already has a (fresher) WS value.
  useEffect(() => {
    const pending = subscribedMarkets.filter(
      (market) => !seededSlugsRef.current.has(market.slug),
    );
    if (pending.length === 0) return;
    pending.sort((a, b) => {
      const pa = prioritySlugs?.has(a.slug) ? 0 : 1;
      const pb = prioritySlugs?.has(b.slug) ? 0 : 1;
      return pa - pb;
    });

    let cancelled = false;

    const applySeed = (slug: string, price: number | null) => {
      seededSlugsRef.current.add(slug);
      if (cancelled || price == null || price <= 0) return;
      setPricesBySlug((prev) => {
        if (prev.has(slug)) return prev;
        const next = new Map(prev);
        next.set(slug, price);
        return next;
      });
    };

    const fetchChunk = async (
      chunk: { slug: string; source: ProviderSource }[],
    ) => {
      try {
        const results = await predictClient.getOrderbooks(
          chunk.map((market) => ({
            slug: market.slug,
            source: market.source,
            outcome: "yes" as const,
          })),
        );
        if (cancelled) return;
        const bySlug = new Map(results.map((result) => [result.slug, result]));
        for (const market of chunk) {
          const orderbook = bySlug.get(market.slug)?.orderbook;
          const price =
            orderbook &&
            orderbook.market_id === market.slug &&
            orderbook.outcome === "yes"
              ? pickBestAsk(orderbook, "yes")
              : null;
          applySeed(market.slug, price);
        }
      } catch {
        if (cancelled) return;
        for (const market of chunk) applySeed(market.slug, null);
      }
    };

    void (async () => {
      for (let i = 0; i < pending.length; i += SEED_BATCH_SIZE) {
        if (cancelled) return;
        await fetchChunk(pending.slice(i, i + SEED_BATCH_SIZE));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [predictClient, prioritySlugs, subscribedMarkets]);

  // Mirror the selected market's live best-ask into the same map so the panel
  // reads one price source for every market. This keeps the price continuous
  // when a market toggles between selected and visible, instead of briefly
  // dropping to the stale static snapshot.
  useEffect(() => {
    if (!selectedSlug || selectedPrice == null || selectedPrice <= 0) return;
    setPricesBySlug((prev) => {
      if (prev.get(selectedSlug) === selectedPrice) return prev;
      const next = new Map(prev);
      next.set(selectedSlug, selectedPrice);
      return next;
    });
  }, [selectedSlug, selectedPrice]);

  // Drop prices (and seed tracking) for markets that left the match's set. The
  // selected slug is retained even though it is excluded from the subscription,
  // so its last live price survives until it rejoins.
  useEffect(() => {
    seededSlugsRef.current.forEach((slug) => {
      if (!subscribedSlugSet.has(slug)) seededSlugsRef.current.delete(slug);
    });
    setPricesBySlug((prev) => {
      let changed = false;
      const next = new Map<string, number>();
      prev.forEach((price, slug) => {
        if (subscribedSlugSet.has(slug) || slug === selectedSlug) {
          next.set(slug, price);
          return;
        }
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [selectedSlug, subscribedSlugSet]);

  // Long-lived WS listener, registered once per client. Reads the valid-slug
  // set from a ref so it survives selection/category changes without
  // re-subscribing.
  useEffect(() => {
    if (!wsClient) return;
    return wsClient.on("orderbook", (msg: WsDataMessage<WsOrderbookEvent>) => {
      const slug = msg.data.market_slug;
      if (
        !subscribedSlugSetRef.current.has(slug) ||
        msg.data.outcome !== "yes"
      ) {
        return;
      }
      const orderbook: Orderbook = {
        market_id: slug,
        outcome: "yes",
        bids: msg.data.bids,
        asks: msg.data.asks,
        spread: msg.data.spread,
      };
      const ask = pickBestAsk(orderbook, "yes");
      setPricesBySlug((prev) => {
        if (ask == null || ask <= 0) {
          if (!prev.has(slug)) return prev;
          const next = new Map(prev);
          next.delete(slug);
          return next;
        }
        if (prev.get(slug) === ask) return prev;
        const next = new Map(prev);
        next.set(slug, ask);
        return next;
      });
    });
  }, [wsClient]);

  // Delta (un)subscribe: a selection or category change only toggles the slugs
  // that actually entered/left the set instead of re-subscribing every market.
  const wsSubscribedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!wsClient) return;
    const current = wsSubscribedRef.current;
    const added: string[] = [];
    const removed: string[] = [];
    subscribedSlugSet.forEach((slug) => {
      if (!current.has(slug)) added.push(slug);
    });
    current.forEach((slug) => {
      if (!subscribedSlugSet.has(slug)) removed.push(slug);
    });
    if (added.length > 0) wsClient.subscribe(["orderbook"], added);
    if (removed.length > 0) wsClient.unsubscribe(["orderbook"], removed);
    wsSubscribedRef.current = new Set(subscribedSlugSet);
  }, [subscribedSlugSet, wsClient]);

  // Tear down every subscription when the client changes or the panel unmounts.
  useEffect(() => {
    if (!wsClient) return;
    return () => {
      const all = Array.from(wsSubscribedRef.current);
      if (all.length > 0) wsClient.unsubscribe(["orderbook"], all);
      wsSubscribedRef.current = new Set();
    };
  }, [wsClient]);

  return pricesBySlug;
}

function GroupRow({
  group,
  options,
  selectedSlug,
  orderbookPricesBySlug,
  onSelect,
  label,
}: {
  group: MarketGroup;
  options: MarketOption[];
  selectedSlug: string;
  orderbookPricesBySlug: Map<string, number>;
  onSelect: (slug: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const [format] = useOddsFormat();

  if (options.length === 0) return null;

  const single = options.length === 1;
  // Option odds use each market's live YES best-ask (mirrored into the map for
  // the selected market too) so they line up with the order book. An open
  // market whose first live price has not arrived yet shows nothing: the static
  // snapshot drifts from the live book, so flashing it would make the price
  // visibly jump once the real value loads. Closed markets keep their static
  // settled price as the only available value.
  const optionOdds = (option: MarketOption): string | null => {
    const live = orderbookPricesBySlug.get(option.market.slug);
    if (live != null) return convertPrice(live, format);
    if (option.market.status === "open") return null;
    return convertPrice(yesAskPrice(option.market), format);
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
          {optionOdds(options[0]) != null && (
            <span className="shrink-0 text-[10px] font-semibold tabular-nums text-bearish">
              {optionOdds(options[0])}
            </span>
          )}
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
                {optionOdds(o) != null && (
                  <span className="text-[10px] font-medium text-bearish">
                    {optionOdds(o)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
