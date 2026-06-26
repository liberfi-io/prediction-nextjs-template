"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import {
  useWallets,
  type EvmWalletAdapter,
} from "@liberfi.io/wallet-connector";
import {
  usePredictWallet,
  PREDICT_SELL_MODAL_ID,
  type PredictSellModalParams,
  PREDICT_REDEEM_MODAL_ID,
  type PredictRedeemModalParams,
} from "@liberfi.io/ui-predict";
import {
  useOrdersMulti,
  useInfiniteTradesMulti,
  useCancelOrder,
  usePolymarket,
  buildPolymarketL2Headers,
  type PolymarketSigner,
  type PredictMarket,
  type PredictPosition,
  type PredictOrder,
  type PredictTrade,
} from "@liberfi.io/react-predict";
import { cn, toast, PolymarketIcon, KalshiIcon, Sortable } from "@liberfi.io/ui";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import { useVirtualizer } from "@tanstack/react-virtual";
import { predictEventHref } from "./predict-source";
import { Shimmer } from "./portfolio-skeleton";
import { ENABLE_KALSHI } from "../../libs/featureFlags";
import {
  getCancelOrderConfirmationMessages,
  useCancelOrderResultConfirmation,
} from "../../features/trade-feedback/cancelOrderConfirmation";
import { useWorldcupMatches } from "../../features/worldcup/data/queries";
import { resolveWorldcupEventAttribution } from "../../features/worldcup/data/resolve-event-attribution";
import {
  FIFA_AVATAR,
  buildWorldcupTeamHint,
  worldcupMatchTitle,
  type WorldCupTranslate,
} from "../../features/worldcup/display";
import {
  marketLabel,
  sportsType,
} from "../../features/worldcup/components/detail/marketGrouping";
import type { WcMatch } from "../../features/worldcup/types";

export type ActivityTab = "positions" | "orders" | "history";

/** Fixed scroll height used when panels are embedded (non flex-fill) layouts. */
export const ACTIVITY_LIST_HEIGHT = 600;

/**
 * Temporarily hide the source (Polymarket / Kalshi) badge shown in the row
 * subtitle of the positions / orders / history lists. Kept as a flag (not
 * removed) so it can be re-enabled by flipping this back to `true`.
 */
const SHOW_SOURCE_BADGE = false;

// ---------------------------------------------------------------------------
// Positions panel
// ---------------------------------------------------------------------------

export type PositionSortKey = "value" | "pnl" | "size";
type ActivityEvent = {
  slug?: string;
  title?: string;
  image_url?: string;
  title_trans?: unknown;
};
type ActivityOutcome = {
  label?: string;
  label_trans?: unknown;
};
type ActivityMarket = {
  slug?: string;
  event_slug?: string;
  question?: string;
  image_url?: string;
  provider_meta?: Record<string, unknown>;
  providerMeta?: Record<string, unknown>;
  question_trans?: unknown;
  group_item_title_trans?: unknown;
  outcomes?: ActivityOutcome[];
};
type TranslatedEvent = ActivityEvent & {
  title_trans?: unknown;
};
type TranslatedMarket = ActivityMarket & {
  question_trans?: unknown;
  outcomes?: ActivityOutcome[];
};
type WorldcupMatchBySlug = Map<string, WcMatch>;
type ActivityItem = {
  event?: ActivityEvent;
  market?: ActivityMarket;
};
type ActivityDisplay = {
  title: string;
  subtitle: string;
  imageUrl?: string;
  outcomeLabel?: string;
  plainSide?: boolean;
};

type PositionSortOrder = "asc" | "desc";

const POSITION_ROW_GRID =
  "grid-cols-[minmax(280px,1.4fr)_minmax(72px,0.45fr)_minmax(116px,0.8fr)_minmax(86px,0.55fr)_minmax(86px,0.55fr)_minmax(112px,0.8fr)_minmax(96px,0.55fr)]";

const POSITION_TABLE_MIN_WIDTH = 980;

function positionSortValue(p: PredictPosition, key: PositionSortKey): number {
  switch (key) {
    case "value":
      return p.current_value ?? p.size * (p.current_price ?? 0);
    case "pnl":
      return p.pnl ?? 0;
    case "size":
      return p.size ?? 0;
  }
}

function positionRowKey(position: PredictPosition, fallback: number): string {
  return [
    position.source,
    position.market?.slug ?? fallback,
    position.side || "unknown",
  ].join("-");
}

function translatedText(base: string | undefined, translated: unknown): string | undefined {
  return typeof translated === "string" && translated.trim() ? translated : base;
}

function activityEventTitle(item: ActivityItem): string {
  const event = item.event as TranslatedEvent | undefined;
  return translatedText(item.event?.title, event?.title_trans) ?? "—";
}

function activityOutcomeLabel(item: ActivityItem): string {
  const market = item.market as TranslatedMarket | undefined;
  const outcome = market?.outcomes?.[0];
  return translatedText(outcome?.label, outcome?.label_trans) ?? "";
}

function worldcupMatchSlugForActivity(item: ActivityItem): string | null {
  const slug = item.market?.event_slug || item.event?.slug;
  if (!slug) return null;
  return resolveWorldcupEventAttribution(slug)?.matchSlug ?? null;
}

function toWorldcupPredictMarket(market: ActivityMarket): PredictMarket {
  return {
    ...market,
    slug: market.slug ?? "",
    source: "polymarket",
    status: "open",
    question: market.question ?? "",
    event_slug: market.event_slug ?? "",
    image_url: market.image_url,
    provider_meta: market.provider_meta ?? market.providerMeta,
  } as PredictMarket;
}

function isWorldcupMoneylineMarket(market: ActivityMarket): boolean {
  const type = sportsType(toWorldcupPredictMarket(market));
  return type === "moneyline" || type === "soccer_match_winner";
}

function isWorldcupBothTeamsToScoreMarket(market: ActivityMarket): boolean {
  return sportsType(toWorldcupPredictMarket(market)) === "both_teams_to_score";
}

function worldcupMoneylineOutcomeLabel(
  market: ActivityMarket,
  match: WcMatch,
  translate: WorldCupTranslate,
): string | undefined {
  if (!isWorldcupMoneylineMarket(market)) return undefined;
  const hint = buildWorldcupTeamHint(match, translate);
  const label = marketLabel(toWorldcupPredictMarket(market), hint);
  if (!label) return undefined;
  if (hint?.drawLabel && label === hint.drawLabel) {
    return translate("extend.worldcup.moneylineDraw");
  }
  if (hint?.homeLabel && label === hint.homeLabel) {
    return translate("extend.worldcup.teamWins", { team: hint.homeLabel });
  }
  if (hint?.awayLabel && label === hint.awayLabel) {
    return translate("extend.worldcup.teamWins", { team: hint.awayLabel });
  }
  return undefined;
}

function activityDisplay(
  item: ActivityItem,
  worldcupMatchBySlug: WorldcupMatchBySlug,
  translate: WorldCupTranslate,
): ActivityDisplay {
  const matchSlug = worldcupMatchSlugForActivity(item);
  const match = matchSlug ? worldcupMatchBySlug.get(matchSlug) : undefined;
  if (match && item.market) {
    const hint = buildWorldcupTeamHint(match, translate);
    const outcomeLabel = worldcupMoneylineOutcomeLabel(item.market, match, translate);
    const isBothTeamsToScore = isWorldcupBothTeamsToScoreMarket(item.market);
    return {
      title: worldcupMatchTitle(match, hint) ?? activityEventTitle(item),
      subtitle: outcomeLabel
        ? ""
        : isBothTeamsToScore
          ? translate("extend.worldcup.bothTeamsToScore")
          : marketLabel(toWorldcupPredictMarket(item.market), hint),
      imageUrl: FIFA_AVATAR,
      outcomeLabel,
      plainSide: Boolean(outcomeLabel || isBothTeamsToScore),
    };
  }

  return {
    title: activityEventTitle(item),
    subtitle: activityOutcomeLabel(item),
    imageUrl: item.market?.image_url || item.event?.image_url,
  };
}

export function PositionsPanel({
  positions,
  isLoading,
  search,
  fill = true,
}: {
  positions: PredictPosition[];
  isLoading: boolean;
  search: string;
  /** Fill the available flex height (page layout) vs. fixed max-height (embedded). */
  fill?: boolean;
}) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<{
    field: PositionSortKey;
    order: PositionSortOrder;
  } | null>(null);
  const translate = t as WorldCupTranslate;
  const hasWorldcupPositions = useMemo(
    () => positions.some((position) => Boolean(worldcupMatchSlugForActivity(position))),
    [positions],
  );
  const { data: worldcupMatches = [] } = useWorldcupMatches({
    enabled: hasWorldcupPositions,
  });
  const worldcupMatchBySlug = useMemo(
    () => new Map(worldcupMatches.map((match) => [match.slug, match])),
    [worldcupMatches],
  );

  const filtered = useMemo(() => {
    let list = positions;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => {
          const display = activityDisplay(p, worldcupMatchBySlug, translate);
          return (
            display.title.toLowerCase().includes(q) ||
            display.subtitle.toLowerCase().includes(q)
          );
        },
      );
    }
    const sorted = [...list];
    if (!sort) return sorted;
    const dir = sort.order === "asc" ? 1 : -1;
    return sorted.sort((a, b) => dir * (positionSortValue(a, sort.field) - positionSortValue(b, sort.field)));
  }, [positions, search, sort, translate, worldcupMatchBySlug]);

  const handleSort =
    (field: PositionSortKey) => (dir: "asc" | "desc" | undefined) => {
      setSort(dir ? { field, order: dir } : null);
    };
  const sortFor = (field: PositionSortKey): PositionSortOrder | undefined =>
    sort?.field === field ? sort.order : undefined;

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  if (isLoading) return <PanelSkeleton />;

  return (
    <div className={cn("flex flex-col", fill && "min-h-0 flex-1")}>
      {/* Position rows */}
      {filtered.length === 0 ? (
        <EmptyState message={t("extend.portfolio.noPositions")} icon="positions" />
      ) : (
        <div
          ref={parentRef}
          className={cn(
            "overflow-y-auto overflow-x-hidden rounded-xl border border-zinc-800/30 bg-[#0f1010] no-scrollbar",
            fill && "min-h-0 flex-1",
          )}
          style={fill ? undefined : { maxHeight: ACTIVITY_LIST_HEIGHT }}
        >
          <div className="overflow-x-auto overflow-y-visible no-scrollbar">
            <div style={{ minWidth: POSITION_TABLE_MIN_WIDTH, width: "100%" }}>
            <div
              className={cn(
                "sticky top-0 z-20 grid items-center gap-4 border-b border-zinc-800/50 bg-[#111113]/95 px-5 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 backdrop-blur",
                POSITION_ROW_GRID,
              )}
            >
              <span>{t("extend.leaderboard.detail.colMarket")}</span>
              <span className="flex justify-end">
                <Sortable sort={sortFor("size")} onSortChange={handleSort("size")}>
                  {t("extend.leaderboard.detail.colShares")}
                </Sortable>
              </span>
              <span className="text-right">{t("extend.leaderboard.detail.colAvgNow")}</span>
              <span className="text-right">{t("extend.portfolio.invested")}</span>
              <span className="flex justify-end">
                <Sortable sort={sortFor("value")} onSortChange={handleSort("value")}>
                  {t("extend.leaderboard.detail.colValue")}
                </Sortable>
              </span>
              <span className="flex justify-end">
                <Sortable sort={sortFor("pnl")} onSortChange={handleSort("pnl")}>
                  {t("extend.leaderboard.detail.colTotalPnl")}
                </Sortable>
              </span>
              <span className="sticky right-0 z-30 -mr-5 bg-[#111113]/95 py-2 pr-5 text-right lg:static lg:mr-0 lg:bg-transparent lg:py-0">
                {t("extend.portfolio.action")}
              </span>
            </div>
            <div className="relative w-full bg-[#0f1010]" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((vItem) => {
                const pos = filtered[vItem.index];
                return (
                  <div
                    key={positionRowKey(pos, vItem.index)}
                    ref={virtualizer.measureElement}
                    data-index={vItem.index}
                    className="absolute left-0 top-0 w-full"
                    style={{ transform: `translateY(${vItem.start}px)` }}
                  >
                    <PositionRow
                      position={pos}
                      translate={translate}
                      worldcupMatchBySlug={worldcupMatchBySlug}
                      isLast={vItem.index === filtered.length - 1}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PositionRow({
  position,
  translate,
  worldcupMatchBySlug,
  isLast,
}: {
  position: PredictPosition;
  translate: WorldCupTranslate;
  worldcupMatchBySlug: WorldcupMatchBySlug;
  isLast: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { onOpen: openSellModal } = useAsyncModal<PredictSellModalParams>(PREDICT_SELL_MODAL_ID);
  const { onOpen: openRedeemModal } = useAsyncModal<PredictRedeemModalParams>(PREDICT_REDEEM_MODAL_ID);
  const pnl = position.pnl ?? 0;
  const pnlPercent = position.pnl_percent ?? 0;
  const avgPrice = position.avg_price ?? 0;
  const currentPrice = position.current_price ?? 0;
  const invested = position.size * avgPrice;
  const currentValue = position.current_value ?? position.size * currentPrice;
  const pnlColor = pnl > 0 ? "text-bullish" : pnl < 0 ? "text-bearish" : "text-zinc-400";
  const display = activityDisplay(position, worldcupMatchBySlug, translate);
  const marketLabel = display.title;
  const marketName = display.outcomeLabel ?? display.subtitle;
  const originalSideLabel = position.side;
  const isYes = originalSideLabel?.toLowerCase() === "yes";
  const usePlainSide = Boolean(display.plainSide);
  const sideLabel = usePlainSide
    ? t(isYes ? "extend.worldcup.detail.trade.yes" : "extend.worldcup.detail.trade.no")
    : position.side;
  const showSideCapsule = Boolean(sideLabel);
  const source = position.source;
  const cellBorder = isLast ? "border-b border-transparent" : "border-b border-zinc-800/30";

  const imageUrl = display.imageUrl;
  const eventSlug = position.event?.slug;
  const href = eventSlug ? predictEventHref({ slug: eventSlug, source }) : undefined;
  const handleNavigate = useCallback(() => {
    if (href) router.push(href);
  }, [href, router]);
  const handlePrefetch = useCallback(() => {
    if (href) router.prefetch(href);
  }, [href, router]);

  const handleSell = useCallback(
    () => {
      if (!position.event || !position.market) return;
      openSellModal({
        params: {
          event: position.event,
          market: position.market,
          initialOutcome: (position.side?.toLowerCase() === "yes" ? "yes" : "no") as "yes" | "no",
        },
      });
    },
    [position.event, position.market, position.side, openSellModal],
  );

  const handleRedeem = useCallback(
    () => {
      if (!position.event || !position.market) return;
      openRedeemModal({
        params: {
          event: position.event,
          market: position.market,
          position,
        },
      });
    },
    [position, openRedeemModal],
  );

  return (
    <div
      className={cn(
        "group transition-[background-color] duration-150 hover:bg-zinc-800/30",
      )}
    >
      <div
        className={cn(
          "grid items-stretch gap-4 px-5",
          POSITION_ROW_GRID,
        )}
      >
        {/* Col 1: Icon + event info */}
        <div className={cn("flex min-w-0 items-center gap-3 py-3", cellBorder)}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800/50 bg-zinc-900">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : source === "kalshi" ? (
              <KalshiIcon width={32} height={12} />
            ) : (
              <PolymarketIcon width={24} height={24} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span
              className={cn("mb-1 line-clamp-1 text-sm font-medium text-white", eventSlug && "cursor-pointer hover:underline")}
              onClick={handleNavigate}
              onMouseEnter={handlePrefetch}
            >
              {marketLabel}
            </span>
            <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-400">
              {marketName && <span className="max-w-[240px] truncate">{marketName}</span>}
              {marketName && showSideCapsule && <span className="text-zinc-600">&bull;</span>}
              {showSideCapsule && (
                <span
                  className={cn(
                    "inline-block shrink-0 text-xs font-medium",
                    usePlainSide ? "" : "rounded px-1.5 py-0.5",
                    isYes ? "text-bullish" : "text-bearish",
                    !usePlainSide && (isYes ? "bg-bullish/10" : "bg-bearish/10"),
                  )}
                >
                  {sideLabel}
                </span>
              )}
              {SHOW_SOURCE_BADGE && (
                <>
                  {(marketName || showSideCapsule) && <span className="text-zinc-600">&bull;</span>}
                  <span className="inline-flex items-center gap-1">
                    {source === "kalshi" ? (
                      <KalshiIcon width={36} height={12} />
                    ) : (
                      <>
                        <PolymarketIcon width={16} height={16} />
                        <span className="text-zinc-400">Polymarket</span>
                      </>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Col 2: Shares */}
        <div className={cn("flex items-center justify-end py-3 text-right text-sm tabular-nums text-zinc-300", cellBorder)}>
          {formatShares(position.size)}
        </div>

        {/* Col 3: Price change */}
        <div className={cn("flex items-center justify-end py-3 text-right", cellBorder)}>
          <span className="text-sm">
            {formatPrice(avgPrice)}{" "}
            <span className="text-zinc-600">&rarr;</span>{" "}
            <span className={currentPrice > avgPrice ? "text-bullish" : currentPrice < avgPrice ? "text-bearish" : ""}>
              {formatPrice(currentPrice)}
            </span>
          </span>
        </div>

        {/* Col 4: Invested */}
        <div className={cn("flex items-center justify-end py-3 text-right", cellBorder)}>
          <div className="text-sm font-medium text-white">${invested.toFixed(2)}</div>
        </div>

        {/* Col 5: Value */}
        <div className={cn("flex items-center justify-end py-3 text-right", cellBorder)}>
          <div className="text-sm font-semibold text-white">${currentValue.toFixed(2)}</div>
        </div>

        {/* Col 6: Total PnL */}
        <div className={cn("flex items-center justify-end py-3 text-right", cellBorder)}>
          <div className={cn("text-xs font-semibold", pnlColor)}>
            {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)} ({pnlPercent >= 0 ? "+" : ""}
            {pnlPercent.toFixed(1)}%)
          </div>
        </div>

        {/* Col 7: Sell / Redeem button */}
        <div
          className={cn(
            "sticky right-0 z-10 -mr-5 flex items-center justify-end bg-[#0f1010] py-3 pr-5 text-right transition-[background-color] duration-150 group-hover:bg-[#1b1d20] lg:static lg:z-auto lg:mr-0 lg:bg-transparent lg:group-hover:bg-transparent",
            cellBorder,
          )}
        >
          {position.redeemable ? (
            <button
              type="button"
              onClick={handleRedeem}
              className="cursor-pointer rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-400 transition-all hover:border-green-500/50 hover:bg-green-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500/60"
            >
              {t("predict.redeem.confirm")}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSell}
              className="cursor-pointer rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500/60"
            >
              {t("extend.portfolio.sell")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders panel
// ---------------------------------------------------------------------------

export function OrdersPanel({
  solanaAddr,
  evmAddr,
  fill = true,
}: {
  solanaAddr: string;
  evmAddr: string;
  fill?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const translate = t as WorldCupTranslate;
  const wallets = useWallets();
  const evmWallet = useMemo(
    () => wallets.find((w) => w.chainNamespace === "EVM" && w.isConnected) as EvmWalletAdapter | undefined,
    [wallets],
  );
  const { polymarketSafeAddress } = usePredictWallet();
  const { credentials, authenticate } = usePolymarket();
  const confirmCancelOrder = useCancelOrderResultConfirmation();
  const cancelResultMessages = useMemo(
    () => getCancelOrderConfirmationMessages(t, i18n),
    [i18n, t],
  );

  // Auto-authenticate with Polymarket to obtain L2 HMAC credentials.
  // Privy embedded wallets sign silently — no user popup.
  useEffect(() => {
    if (credentials || !evmWallet) return;
    let cancelled = false;
    (async () => {
      try {
        const provider = await evmWallet.getEip1193Provider();
        if (!provider || cancelled) return;
        const usesSafe = !!polymarketSafeAddress;
        const signer: PolymarketSigner = {
          address: evmWallet.address,
          signatureType: usesSafe ? 2 : 0,
          signTypedData: async (domain, types, primaryType, value) => {
            const domainFields: { name: string; type: string }[] = [];
            if ("name" in domain) domainFields.push({ name: "name", type: "string" });
            if ("version" in domain) domainFields.push({ name: "version", type: "string" });
            if ("chainId" in domain) domainFields.push({ name: "chainId", type: "uint256" });
            if ("verifyingContract" in domain) domainFields.push({ name: "verifyingContract", type: "address" });
            if ("salt" in domain) domainFields.push({ name: "salt", type: "bytes32" });
            const fullTypes = { EIP712Domain: domainFields, ...types };
            return (await provider.request({
              method: "eth_signTypedData_v4",
              params: [
                evmWallet.address,
                JSON.stringify({ domain, types: fullTypes, primaryType, message: value }),
              ],
            })) as string;
          },
        };
        if (!cancelled) await authenticate(signer);
      } catch {
        // Credential derivation failed — orders will stay in loading state.
      }
    })();
    return () => { cancelled = true; };
  }, [credentials, evmWallet, polymarketSafeAddress, authenticate]);

  const polymarketGetHeaders = useMemo(() => {
    if (!credentials) return undefined;
    return async (): Promise<Record<string, string>> => {
      const headers = await buildPolymarketL2Headers(credentials.address, {
        apiKey: credentials.apiKey,
        secret: credentials.secret,
        passphrase: credentials.passphrase,
        method: "GET",
        requestPath: "/data/orders",
      });
      return headers as unknown as Record<string, string>;
    };
  }, [credentials]);

  const cancelMutation = useCancelOrder(
    {
      getHeaders: credentials
        ? async (vars) => {
            const body = JSON.stringify({ orderID: vars.id });
            const headers = await buildPolymarketL2Headers(credentials.address, {
              apiKey: credentials.apiKey,
              secret: credentials.secret,
              passphrase: credentials.passphrase,
              method: "DELETE",
              requestPath: "/order",
              body,
            });
            return headers as unknown as Record<string, string>;
          }
        : undefined,
    },
    {
      onSuccess: (_data, vars) => {
        void confirmCancelOrder({
          source: vars.source,
          user: vars.source === "kalshi" ? solanaAddr : evmAddr,
          kalshiUser: ENABLE_KALSHI ? solanaAddr || undefined : undefined,
          polymarketUser: evmAddr || undefined,
          orderId: vars.id,
          messages: cancelResultMessages,
          getOrdersHeaders: polymarketGetHeaders,
        });
      },
      onError: () => {
        toast.error(t("extend.portfolio.cancelFailed"));
      },
    },
  );

  const credentialsReady = !!polymarketGetHeaders;
  const { data, isLoading: queryLoading } = useOrdersMulti(
    {
      kalshi_user: ENABLE_KALSHI ? solanaAddr || undefined : undefined,
      polymarket_user: evmAddr || undefined,
    },
    { getHeaders: polymarketGetHeaders },
    { enabled: credentialsReady && Boolean(evmAddr), refetchInterval: false },
  );
  const isLoading = queryLoading || !credentialsReady;

  const orders = useMemo(() => {
    const all = data?.orders ?? [];
    const openStatuses = new Set<string>(["live", "open", "submitted", "pending"]);
    return all.filter((o: PredictOrder) => openStatuses.has(o.status));
  }, [data]);
  const hasWorldcupOrders = useMemo(
    () => orders.some((order) => Boolean(worldcupMatchSlugForActivity(order))),
    [orders],
  );
  const { data: worldcupMatches = [] } = useWorldcupMatches({
    enabled: hasWorldcupOrders,
  });
  const worldcupMatchBySlug = useMemo(
    () => new Map(worldcupMatches.map((match) => [match.slug, match])),
    [worldcupMatches],
  );

  const handleCancel = useCallback(
    (order: PredictOrder) => {
      cancelMutation.mutate({ source: order.source, id: order.id });
    },
    [cancelMutation],
  );

  const handleNavigate = useCallback(
    (order: PredictOrder) => {
      if (order.event?.slug) {
        router.push(predictEventHref({ slug: order.event.slug, source: order.source }));
      }
    },
    [router],
  );

  const handlePrefetch = useCallback(
    (order: PredictOrder) => {
      if (order.event?.slug) {
        router.prefetch(predictEventHref({ slug: order.event.slug, source: order.source }));
      }
    },
    [router],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  if (isLoading) return <PanelSkeleton />;
  if (orders.length === 0) return <EmptyState message={t("extend.portfolio.noOrders")} icon="orders" />;

  return (
    <div
      ref={parentRef}
      className={cn(
        "mt-4 overflow-auto rounded-xl border border-zinc-800/30 bg-zinc-900/20 custom-scrollbar",
        fill && "min-h-0 flex-1",
      )}
      style={fill ? undefined : { maxHeight: ACTIVITY_LIST_HEIGHT }}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const order = orders[vItem.index];
          return (
            <div
              key={order.id}
              ref={virtualizer.measureElement}
              data-index={vItem.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${vItem.start}px)` }}
            >
              <OrderRow
                order={order}
                onCancel={handleCancel}
                onNavigate={handleNavigate}
	                onPrefetch={handlePrefetch}
	                isCancelling={cancelMutation.isPending}
	                isLast={vItem.index === orders.length - 1}
	                translate={translate}
	                worldcupMatchBySlug={worldcupMatchBySlug}
	              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderRow({
  order,
  onCancel,
  onNavigate,
  onPrefetch,
  isCancelling,
  isLast,
  translate,
  worldcupMatchBySlug,
}: {
  order: PredictOrder;
  onCancel: (order: PredictOrder) => void;
  onNavigate: (order: PredictOrder) => void;
  onPrefetch: (order: PredictOrder) => void;
  isCancelling: boolean;
  isLast: boolean;
  translate: WorldCupTranslate;
  worldcupMatchBySlug: WorldcupMatchBySlug;
}) {
  const { t } = useTranslation();
  const isBuy = order.side === "BUY";
  const source = order.source;
  const display = activityDisplay(order, worldcupMatchBySlug, translate);
  const imageUrl = display.imageUrl;
  const title = display.title;
  const subtitle = display.subtitle;
  const canCancel = !order.status || !({ matched: 1, cancelled: 1, invalid: 1, closed: 1, failed: 1, expired: 1 } as Record<string, number>)[order.status];

  return (
    <div
      className={cn(
        "group transition-[background-color] duration-150 hover:bg-zinc-800/30",
        !isLast && "border-b border-zinc-800/30",
      )}
    >
      {/* Desktop */}
      <div className="hidden items-center gap-4 px-5 py-4 lg:flex">
        {/* Image */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800/50 bg-zinc-900">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : source === "kalshi" ? (
            <KalshiIcon width={32} height={12} />
          ) : (
            <PolymarketIcon width={24} height={24} />
          )}
        </div>

        {/* Title + source */}
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "mb-1 line-clamp-1 text-sm font-medium text-white",
              order.event?.slug && "cursor-pointer hover:underline",
            )}
            onClick={() => onNavigate(order)}
            onMouseEnter={() => onPrefetch(order)}
          >
            {title}
          </span>
          {subtitle && (
            <span className="mb-0.5 line-clamp-1 text-xs text-zinc-400">
              {subtitle}
            </span>
          )}
          {SHOW_SOURCE_BADGE && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              {source === "kalshi" ? (
                <KalshiIcon width={36} height={12} />
              ) : (
                <>
                  <PolymarketIcon width={14} height={14} />
                  <span>Polymarket</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Side + Outcome */}
        <div className="min-w-[100px] shrink-0 text-center">
          <span
            className={cn(
              "inline-block rounded px-2 py-1 text-xs font-semibold",
              isBuy ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish",
            )}
          >
            {order.side} {order.outcome ? <span className="capitalize">{order.outcome}</span> : null}
          </span>
        </div>

        {/* Price */}
        <div className="min-w-[80px] shrink-0 text-right">
          <div className="text-[10px] text-zinc-500">{t("extend.portfolio.price")}</div>
          <div className="text-sm font-mono font-medium text-white">
            {order.price ? formatPrice(parseFloat(order.price)) : "—"}
          </div>
        </div>

        {/* Filled / Total */}
        <div className="min-w-[100px] shrink-0 text-right">
          <div className="text-[10px] text-zinc-500">{t("extend.portfolio.filledTotal")}</div>
          <div className="text-sm font-mono font-medium text-white">
            {order.size_matched ?? "0"}<span className="text-zinc-500">/{order.original_size ?? "—"}</span>
          </div>
        </div>

        {/* Cancel button */}
        {canCancel && (
          <button
            type="button"
            onClick={() => onCancel(order)}
            disabled={isCancelling}
            className="w-[72px] shrink-0 inline-flex items-center justify-center gap-1.5 cursor-pointer rounded-lg border border-red-500/30 bg-red-500/10 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
          >
            {isCancelling && (
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {t("extend.portfolio.cancel")}
          </button>
        )}
      </div>

      {/* Compact layout (tablet + mobile) */}
      <div className="flex items-center gap-3 p-4 lg:hidden">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800/50 bg-zinc-900">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : source === "kalshi" ? (
            <KalshiIcon width={30} height={11} />
          ) : (
            <PolymarketIcon width={22} height={22} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "truncate text-sm font-medium text-white block",
              order.event?.slug && "cursor-pointer hover:underline",
            )}
            onClick={() => onNavigate(order)}
            onMouseEnter={() => onPrefetch(order)}
          >
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 block truncate text-xs text-zinc-400">
              {subtitle}
            </span>
          )}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-semibold",
                isBuy ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish",
              )}
            >
              {order.side} {order.outcome ? <span className="capitalize">{order.outcome}</span> : null}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-medium text-white">
            {order.price ? formatPrice(parseFloat(order.price)) : "—"}
          </div>
          <div className="font-mono text-xs text-zinc-400">
            {order.size_matched ?? "0"}<span className="text-zinc-600">/{order.original_size ?? "—"}</span>
          </div>
        </div>
        {canCancel && (
          <button
            type="button"
            onClick={() => onCancel(order)}
            disabled={isCancelling}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 cursor-pointer rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 disabled:opacity-50"
          >
            {isCancelling && (
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {t("extend.portfolio.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trades (history) panel
// ---------------------------------------------------------------------------

export function TradesPanel({
  solanaAddr,
  evmAddr,
  fill = true,
}: {
  solanaAddr: string;
  evmAddr: string;
  fill?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const translate = t as WorldCupTranslate;

  const {
    data: tradesData,
    isLoading,
    fetchNextPage,
    hasNextPage: hasMore,
    isFetchingNextPage: isFetchingMore,
  } = useInfiniteTradesMulti({
    kalshi_user: ENABLE_KALSHI ? solanaAddr || undefined : undefined,
    polymarket_user: evmAddr || undefined,
    limit: 50,
  });

  const trades = useMemo(
    () => tradesData?.pages.flatMap((p) => p.items) ?? [],
    [tradesData],
  );
  const hasWorldcupTrades = useMemo(
    () => trades.some((trade) => Boolean(worldcupMatchSlugForActivity(trade))),
    [trades],
  );
  const { data: worldcupMatches = [] } = useWorldcupMatches({
    enabled: hasWorldcupTrades,
  });
  const worldcupMatchBySlug = useMemo(
    () => new Map(worldcupMatches.map((match) => [match.slug, match])),
    [worldcupMatches],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: trades.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    const last = items[items.length - 1];
    if (!last) return;
    if (last.index >= trades.length - 5 && hasMore && !isFetchingMore) {
      fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), trades.length, hasMore, isFetchingMore, fetchNextPage]);

  const handleNavigate = useCallback(
    (trade: PredictTrade) => {
      if (trade.event?.slug) {
        router.push(predictEventHref({ slug: trade.event.slug, source: trade.source }));
      }
    },
    [router],
  );

  const handlePrefetch = useCallback(
    (trade: PredictTrade) => {
      if (trade.event?.slug) {
        router.prefetch(predictEventHref({ slug: trade.event.slug, source: trade.source }));
      }
    },
    [router],
  );

  if (isLoading) return <PanelSkeleton />;
  if (trades.length === 0) return <EmptyState message={t("extend.portfolio.noTrades")} icon="trades" />;

  return (
    <div
      ref={parentRef}
      className={cn(
        "mt-4 overflow-auto rounded-xl border border-zinc-800/30 bg-zinc-900/20 custom-scrollbar",
        fill && "min-h-0 flex-1",
      )}
      style={fill ? undefined : { maxHeight: ACTIVITY_LIST_HEIGHT }}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const trade = trades[vItem.index];
          return (
            <div
              key={trade.id ?? vItem.index}
              ref={virtualizer.measureElement}
              data-index={vItem.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${vItem.start}px)` }}
            >
              <TradeRow
                trade={trade}
	                isLast={vItem.index === trades.length - 1}
	                onNavigate={handleNavigate}
	                onPrefetch={handlePrefetch}
	                translate={translate}
	                worldcupMatchBySlug={worldcupMatchBySlug}
	              />
            </div>
          );
        })}
      </div>
      {isFetchingMore && (
        <div className="flex justify-center border-t border-zinc-800/30 py-3">
          <span className="text-xs text-zinc-500">{t("extend.portfolio.loadMore")}...</span>
        </div>
      )}
    </div>
  );
}

function TradeRow({
  trade,
  isLast,
  onNavigate,
  onPrefetch,
  translate,
  worldcupMatchBySlug,
}: {
  trade: PredictTrade;
  isLast: boolean;
  onNavigate: (trade: PredictTrade) => void;
  onPrefetch: (trade: PredictTrade) => void;
  translate: WorldCupTranslate;
  worldcupMatchBySlug: WorldcupMatchBySlug;
}) {
  const { t } = useTranslation();
  const isRedeem = trade.type === "REDEEM";
  const isBuy = trade.side?.toUpperCase() === "BUY";
  const timeStr = formatTimestamp(trade.timestamp);
  const price = trade.price ?? 0;
  const usdSize = trade.usd_size ?? 0;
  const source = trade.source;
  const display = activityDisplay(trade, worldcupMatchBySlug, translate);
  const eventTitle = display.title;
  const marketQuestion = display.subtitle;
  const outcomeLabel = trade.outcome ?? "—";
  const tradeImageUrl = display.imageUrl;

  return (
    <div
      className={cn(
        "group transition-[background-color] duration-150 hover:bg-zinc-800/30",
        !isLast && "border-b border-zinc-800/30",
      )}
    >
      {/* Desktop row */}
      <div className="hidden items-center gap-4 px-5 py-4 lg:flex">
        {/* Col 1: Icon + title + source */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800/50 bg-zinc-900">
            {tradeImageUrl ? (
              <img src={tradeImageUrl} alt="" className="h-full w-full object-cover" />
            ) : source === "kalshi" ? (
              <KalshiIcon width={32} height={12} />
            ) : (
              <PolymarketIcon width={24} height={24} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {(eventTitle || marketQuestion) && (
              <span
                className={cn(
                  "mb-0.5 line-clamp-1 text-sm font-medium text-white",
                  trade.event?.slug && "cursor-pointer hover:underline",
                )}
                onClick={() => onNavigate(trade)}
                onMouseEnter={() => onPrefetch(trade)}
              >
                {eventTitle || marketQuestion}
              </span>
            )}
            {eventTitle && marketQuestion && eventTitle !== marketQuestion && (
              <span className="mb-0.5 line-clamp-1 text-xs text-zinc-400">
                {marketQuestion}
              </span>
            )}
            {SHOW_SOURCE_BADGE && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  {source === "kalshi" ? (
                    <KalshiIcon width={36} height={12} />
                  ) : (
                    <>
                      <PolymarketIcon width={14} height={14} />
                      <span className="text-zinc-500">Polymarket</span>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Col 2: Side + Outcome badge */}
        <div className="min-w-[120px] shrink-0 text-center">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-semibold",
              isRedeem
                ? "bg-primary/10 text-primary"
                : isBuy
                  ? "bg-bullish/10 text-bullish"
                  : "bg-bearish/10 text-bearish",
            )}
          >
            {isRedeem ? t("predict.profile.redeem") : trade.side}
            {outcomeLabel !== "—" && <span className="capitalize"> {outcomeLabel}</span>}
          </span>
        </div>

        {/* Col 3: Price x Shares = Total */}
        <div className="min-w-[160px] shrink-0 text-right">
          {isRedeem ? (
            <>
              {trade.size > 0 && (
                <div className="text-xs font-mono text-zinc-400">
                  {formatShares(trade.size)}{t("predict.trade.sharesUnit")}
                </div>
              )}
              <div className="text-base font-bold text-white">
                {usdSize > 0 ? `+$${usdSize.toFixed(2)}` : "$0.00"}
              </div>
            </>
          ) : (
            <>
              <div className="text-xs font-mono text-zinc-400">
                {formatPrice(price)} &times; {formatShares(trade.size)}{t("predict.trade.sharesUnit")}
              </div>
              <div className="text-base font-bold text-white">${usdSize.toFixed(2)}</div>
            </>
          )}
        </div>

        {/* Col 4: Time */}
        <div className="min-w-[80px] shrink-0 text-right">
          <span className="whitespace-nowrap text-xs text-zinc-500">{timeStr}</span>
        </div>
      </div>

      {/* Compact layout (tablet + mobile) */}
      <div className="flex items-center gap-3 p-4 lg:hidden">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800/50 bg-zinc-900">
          {tradeImageUrl ? (
            <img src={tradeImageUrl} alt="" className="h-full w-full object-cover" />
          ) : source === "kalshi" ? (
            <KalshiIcon width={30} height={11} />
          ) : (
            <PolymarketIcon width={22} height={22} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {(eventTitle || marketQuestion) && (
            <span
              className={cn(
                "truncate text-sm font-medium text-white block",
                trade.event?.slug && "cursor-pointer hover:underline",
              )}
              onClick={() => onNavigate(trade)}
              onMouseEnter={() => onPrefetch(trade)}
            >
              {eventTitle || marketQuestion}
            </span>
          )}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold",
                isRedeem
                  ? "bg-primary/10 text-primary"
                  : isBuy
                    ? "bg-bullish/10 text-bullish"
                    : "bg-bearish/10 text-bearish",
              )}
            >
              {isRedeem ? t("predict.profile.redeem") : trade.side}
              {outcomeLabel !== "—" && <span className="capitalize"> {outcomeLabel}</span>}
            </span>
            <span className="text-zinc-500">{timeStr}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {isRedeem ? (
            <>
              <div className="text-sm font-bold text-white">
                {usdSize > 0 ? `+$${usdSize.toFixed(2)}` : "$0.00"}
              </div>
              {trade.size > 0 && (
                <div className="font-mono text-xs text-zinc-400">
                  {formatShares(trade.size)}{t("predict.trade.sharesUnit")}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-white">${usdSize.toFixed(2)}</div>
              <div className="font-mono text-xs text-zinc-400">
                {formatPrice(price)} &times; {formatShares(trade.size)}{t("predict.trade.sharesUnit")}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers & icons
// ---------------------------------------------------------------------------

export function EmptyState({ message, icon = "default" }: { message: string; icon?: "positions" | "orders" | "trades" | "default" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <EmptyIcon type={icon} />
      <span className="text-sm text-zinc-500">{message}</span>
    </div>
  );
}

function EmptyIcon({ type }: { type: string }) {
  const shared = { viewBox: "0 0 24 24", width: 40, height: 40, fill: "none", stroke: "currentColor", strokeWidth: 1, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, style: { color: "#3f3f46" } as React.CSSProperties };
  if (type === "positions") {
    return (
      <svg {...shared}>
        <path d="M3 3v16a2 2 0 0 0 2 2h16" />
        <path d="M7 16l4-8 4 4 6-10" />
      </svg>
    );
  }
  if (type === "orders") {
    return (
      <svg {...shared}>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M8 13h2" />
        <path d="M8 17h2" />
      </svg>
    );
  }
  if (type === "trades") {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }
  return (
    <svg {...shared}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function PanelSkeleton() {
  return (
    <div
      className="mt-4"
      style={{
        borderRadius: 12,
        border: "1px solid rgba(39,39,42,0.3)",
        background: "rgba(24,24,27,0.2)",
        overflow: "hidden",
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{ borderBottom: i < 3 ? "1px solid rgba(39,39,42,0.3)" : "none" }}
        >
          {/* Desktop shimmer */}
          <div className="hidden lg:flex items-center gap-3" style={{ padding: "16px 20px" }}>
            <Shimmer delay={i * 120} style={{ height: 44, width: 44, borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Shimmer delay={i * 120 + 50} style={{ height: 14, width: i % 2 === 0 ? "65%" : "50%", marginBottom: 8 }} />
              <Shimmer delay={i * 120 + 100} style={{ height: 10, width: "40%" }} />
            </div>
            <Shimmer delay={i * 120 + 80} style={{ height: 20, width: 72, flexShrink: 0 }} />
          </div>
          {/* Compact shimmer (tablet + mobile) */}
          <div className="lg:hidden" style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
              <Shimmer delay={i * 120} style={{ height: 40, width: 40, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Shimmer delay={i * 120 + 50} style={{ height: 14, width: i % 2 === 0 ? "75%" : "60%", marginBottom: 6 }} />
                <Shimmer delay={i * 120 + 100} style={{ height: 10, width: "35%" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Shimmer delay={i * 120 + 80} style={{ height: 12, width: 90 }} />
              <Shimmer delay={i * 120 + 120} style={{ height: 14, width: 60 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/**
 * Default 2 decimals: Polymarket ROUNDING_CONFIG.size is always 2;
 * DFlow uses 0. 2 is a safe upper bound for all providers.
 */
function formatShares(size: number, maxDecimals = 2): string {
  const factor = Math.pow(10, maxDecimals);
  return parseFloat((Math.floor(size * factor) / factor).toFixed(maxDecimals)).toString();
}

function formatPrice(price: number): string {
  const cents = price * 100;
  if (cents < 1 && cents > 0) return "< 1\u00A2";
  return `${cents.toFixed(1)}\u00A2`;
}

function formatTimestamp(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");
  return `${month}/${day} ${hours}:${mins}`;
}
