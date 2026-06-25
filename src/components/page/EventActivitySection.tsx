"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import {
  usePositionsMulti,
  useOrdersMulti,
  useInfiniteTrades,
  useCancelOrder,
  usePolymarket,
  buildPolymarketL2Headers,
  type PolymarketSigner,
  type PredictEvent,
  type PredictPosition,
  type PredictOrder,
  type PredictTrade,
  type ProviderSource,
} from "@liberfi.io/react-predict";
import {
  usePredictWallet,
  PREDICT_SELL_MODAL_ID,
  type PredictSellModalParams,
  PREDICT_REDEEM_MODAL_ID,
  type PredictRedeemModalParams,
} from "@liberfi.io/ui-predict";
import {
  cn,
  toast,
  KalshiIcon,
  PolymarketIcon,
  EmptyIcon,
  SignInIcon,
} from "@liberfi.io/ui";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import {
  useAuth,
  useWallets,
  type EvmWalletAdapter,
} from "@liberfi.io/wallet-connector";
import { useVirtualizer } from "@tanstack/react-virtual";
import { predictEventHref } from "./predict-source";
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
import { marketLabel as worldcupMarketLabel } from "../../features/worldcup/components/detail/marketGrouping";
import type { WcMatch } from "../../features/worldcup/types";

export type ActivityTab = "positions" | "orders" | "history";

const LIST_HEIGHT = 600;
const SHOW_SOURCE_BADGE = false;
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
  outcomes?: ActivityOutcome[];
};
type TranslatedPositionEvent = ActivityEvent & {
  title_trans?: unknown;
};
type TranslatedPositionMarket = ActivityMarket & {
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
};

function translatedText(base: string | undefined, translated: unknown): string | undefined {
  return typeof translated === "string" && translated.trim() ? translated : base;
}

function activityEventTitle(item: ActivityItem): string {
  const event = item.event as TranslatedPositionEvent | undefined;
  return translatedText(item.event?.title, event?.title_trans) ?? "—";
}

function activityOutcomeLabel(item: ActivityItem): string {
  const market = item.market as TranslatedPositionMarket | undefined;
  const outcome = market?.outcomes?.[0];
  return translatedText(outcome?.label, outcome?.label_trans) ?? "";
}

function worldcupMatchSlugForActivity(item: ActivityItem): string | null {
  const slug = item.market?.event_slug || item.event?.slug;
  if (!slug) return null;
  return resolveWorldcupEventAttribution(slug)?.matchSlug ?? null;
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
    return {
      title: worldcupMatchTitle(match, hint) ?? activityEventTitle(item),
      subtitle: worldcupMarketLabel(item.market as Parameters<typeof worldcupMarketLabel>[0], hint),
      imageUrl: FIFA_AVATAR,
    };
  }

  return {
    title: activityEventTitle(item),
    subtitle: activityOutcomeLabel(item),
    imageUrl: item.market?.image_url || item.event?.image_url,
  };
}

// ---------------------------------------------------------------------------
// Root — drop-in replacement for UserActivitySection
// ---------------------------------------------------------------------------

export function EventActivitySection({
  event,
  walletAddress,
  activeTab: controlledTab,
  hideTabs = false,
}: {
  event: PredictEvent;
  walletAddress?: string;
  /** Externally controlled tab (mobile flattens these into top-level tabs). */
  activeTab?: ActivityTab;
  /** Hide the internal tab bar when the tab is driven externally. */
  hideTabs?: boolean;
}) {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [internalTab, setInternalTab] = useState<ActivityTab>("positions");
  const activeTab = controlledTab ?? internalTab;

  const marketSlugs = useMemo(
    () => event.markets?.map((m) => m.slug) ?? [],
    [event.markets],
  );

  const { data: positionsData, isLoading: positionsLoading } = usePositionsMulti(
    {
      kalshi_user: event.source === "kalshi" ? walletAddress : undefined,
      polymarket_user: event.source === "polymarket" ? walletAddress : undefined,
    },
    { refetchInterval: false },
  );

  const filteredPositions = useMemo(() => {
    if (!positionsData?.positions || !walletAddress) return [];
    if (marketSlugs.length === 0) return positionsData.positions;
    return positionsData.positions.filter(
      (p) => p.market && marketSlugs.includes(p.market.slug),
    );
  }, [positionsData?.positions, marketSlugs, walletAddress]);

  const positionsCount = filteredPositions.length;
  const positionsLabel =
    positionsCount > 0
      ? `${t("extend.portfolio.positions")} (${positionsCount})`
      : t("extend.portfolio.positions");

  const tabs: { key: ActivityTab; label: string }[] = [
    { key: "positions", label: positionsLabel },
    { key: "orders", label: t("extend.portfolio.openOrders") },
    { key: "history", label: t("extend.portfolio.tradeHistory") },
  ];

  return (
    <div
      className={cn(
        "flex flex-col",
        hideTabs ? "" : "px-1 lg:px-4",
      )}
    >
      {/* Tabs — matching PredictPortfolioPage */}
      {!hideTabs && (
        <div className="shrink-0 border-b border-zinc-800/50">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setInternalTab(tab.key)}
                className={cn(
                  "cursor-pointer whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-all",
                  activeTab === tab.key
                    ? "border-bullish text-bullish"
                    : "border-transparent text-zinc-400 hover:text-zinc-300",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {!walletAddress ? (
        <SignInPrompt
          message={t("extend.portfolio.signInPrompt")}
          buttonLabel={t("common.signIn")}
          onSignIn={signIn}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {activeTab === "positions" && (
            <EventPositionsPanel
              positions={filteredPositions}
              isLoading={positionsLoading}
              source={event.source}
            />
          )}
          {activeTab === "orders" && (
            <EventOrdersPanel
              source={event.source}
              walletAddress={walletAddress}
              marketSlugs={marketSlugs}
            />
          )}
          {activeTab === "history" && (
            <EventTradesPanel
              source={event.source}
              walletAddress={walletAddress}
              marketSlugs={marketSlugs}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Positions panel (matching PredictPortfolioPage.PositionRow style)
// ---------------------------------------------------------------------------

function EventPositionsPanel({
  positions,
  isLoading,
  source,
}: {
  positions: PredictPosition[];
  isLoading: boolean;
  source: ProviderSource;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const translate = t as WorldCupTranslate;
  const { onOpen: openSellModal } = useAsyncModal<PredictSellModalParams>(PREDICT_SELL_MODAL_ID);
  const { onOpen: openRedeemModal } = useAsyncModal<PredictRedeemModalParams>(PREDICT_REDEEM_MODAL_ID);
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

  const handleNavigate = useCallback(
    (pos: PredictPosition) => {
      if (pos.event?.slug) {
        router.push(predictEventHref({ slug: pos.event.slug, source: pos.source }));
      }
    },
    [router],
  );

  const handleSell = useCallback(
    (pos: PredictPosition) => {
      if (!pos.event || !pos.market) return;
      openSellModal({
        params: {
          event: pos.event,
          market: pos.market,
          initialOutcome: (pos.side?.toLowerCase() === "yes" ? "yes" : "no") as "yes" | "no",
        },
      });
    },
    [openSellModal],
  );

  const handleRedeem = useCallback(
    (pos: PredictPosition) => {
      if (!pos.event || !pos.market) return;
      openRedeemModal({
        params: {
          event: pos.event,
          market: pos.market,
          position: pos,
        },
      });
    },
    [openRedeemModal],
  );

  if (isLoading) return <PanelSkeleton />;
  if (positions.length === 0) return <EmptyState message={t("extend.portfolio.noPositions")} />;

  return (
    <div className="mt-4 divide-y divide-zinc-800/30 overflow-y-auto rounded-xl border border-zinc-800/30 bg-zinc-900/20" style={{ maxHeight: LIST_HEIGHT }}>
      {positions.map((pos, i) => {
        const pnl = pos.pnl ?? 0;
        const pnlPercent = pos.pnl_percent ?? 0;
        const avgPrice = pos.avg_price ?? 0;
        const currentPrice = pos.current_price ?? 0;
        const invested = pos.size * avgPrice;
        const currentValue = pos.current_value ?? pos.size * currentPrice;
        const pnlColor = pnl > 0 ? "text-bullish" : pnl < 0 ? "text-bearish" : "text-zinc-400";
        const display = activityDisplay(pos, worldcupMatchBySlug, translate);
        const marketLabel = display.title;
        const marketName = display.subtitle;
        const sideLabel = pos.side;
        const isYes = sideLabel?.toLowerCase() === "yes";
        const imageUrl = display.imageUrl;

        return (
          <div key={`${pos.source}-${pos.market?.slug ?? i}`} className="group transition-[background-color] duration-150 hover:bg-zinc-800/30">
            {/* Desktop row */}
            <div className="hidden items-center gap-4 px-5 py-4 lg:flex">
              <div className="flex min-w-0 flex-1 items-center gap-3">
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
                    className={cn("mb-1 line-clamp-1 text-sm font-medium text-white", pos.event?.slug && "cursor-pointer hover:underline")}
                    onClick={() => handleNavigate(pos)}
                  >
                    {marketLabel}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    {marketName && (
                      <>
                        <span className="max-w-[200px] truncate">{marketName}</span>
                        <span className="text-zinc-700">&bull;</span>
                      </>
                    )}
                    <span className={cn("rounded px-1.5 py-0.5 font-medium", isYes ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish")}>
                      {sideLabel}
                    </span>
                    <span className="text-zinc-600">&bull;</span>
                    <span>{formatShares(pos.size)}{t("predict.trade.sharesUnit")}</span>
                  </div>
                </div>
              </div>
              <div className="min-w-[120px] shrink-0 text-center">
                <span className="text-sm">
                  {formatPrice(avgPrice)}{" "}
                  <span className="text-zinc-600">&rarr;</span>{" "}
                  <span className={currentPrice > avgPrice ? "text-bullish" : currentPrice < avgPrice ? "text-bearish" : ""}>
                    {formatPrice(currentPrice)}
                  </span>
                </span>
              </div>
              <div className="min-w-[90px] shrink-0 text-right">
                <div className="mb-0.5 text-xs text-zinc-500">{t("extend.portfolio.invested")}</div>
                <div className="text-sm font-medium text-white">${invested.toFixed(2)}</div>
              </div>
              <div className="min-w-[130px] shrink-0 text-right">
                <div className="mb-0.5 text-base font-bold text-white">${currentValue.toFixed(2)}</div>
                <div className={cn("text-xs font-semibold", pnlColor)}>
                  {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)} ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
                </div>
              </div>
              <div className="shrink-0">
                {pos.redeemable ? (
                  <button
                    type="button"
                    onClick={() => handleRedeem(pos)}
                    className="cursor-pointer rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-400 transition-all hover:border-green-500/50 hover:bg-green-500/20"
                  >
                    {t("predict.redeem.confirm")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSell(pos)}
                    className="cursor-pointer rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/20"
                  >
                    {t("extend.portfolio.sell")}
                  </button>
                )}
              </div>
            </div>
            {/* Mobile */}
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
                <span className={cn("min-w-0 flex-1 truncate text-sm font-medium text-white block", pos.event?.slug && "cursor-pointer hover:underline")} onClick={() => handleNavigate(pos)}>
                  {marketLabel}
                </span>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
                  <span className={cn("rounded px-1.5 py-0.5 font-medium", isYes ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish")}>
                    {sideLabel}
                  </span>
                  <span>{formatShares(pos.size)}{t("predict.trade.sharesUnit")}</span>
                  <span className="text-zinc-600">&middot;</span>
                  <span className="text-zinc-500">
                    {formatPrice(avgPrice)}<span className="mx-0.5">&rarr;</span>
                    <span className={currentPrice > avgPrice ? "text-bullish" : currentPrice < avgPrice ? "text-bearish" : ""}>{formatPrice(currentPrice)}</span>
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-white">${currentValue.toFixed(2)}</div>
                <div className={cn("text-xs font-semibold", pnlColor)}>
                  {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)} ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
                </div>
              </div>
              {pos.redeemable ? (
                <button
                  type="button"
                  onClick={() => handleRedeem(pos)}
                  className="shrink-0 cursor-pointer rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400"
                >
                  {t("predict.redeem.confirm")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSell(pos)}
                  className="shrink-0 cursor-pointer rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400"
                >
                  {t("extend.portfolio.sell")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders panel (matching PredictPortfolioPage.OrderRow style)
// ---------------------------------------------------------------------------

function EventOrdersPanel({
  source,
  walletAddress,
  marketSlugs,
}: {
  source: ProviderSource;
  walletAddress: string;
  marketSlugs: string[];
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
  const isPoly = source === "polymarket";

  useEffect(() => {
    if (!isPoly || credentials || !evmWallet) return;
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
        // Credential derivation failed
      }
    })();
    return () => { cancelled = true; };
  }, [isPoly, credentials, evmWallet, polymarketSafeAddress, authenticate]);

  const polymarketGetHeaders = useMemo(() => {
    if (!isPoly || !credentials) return undefined;
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
  }, [isPoly, credentials]);

  const cancelGetHeaders = useMemo(() => {
    if (!isPoly || !credentials) return undefined;
    return {
      getHeaders: async (vars: { id: string; source: ProviderSource }) => {
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
      },
    };
  }, [isPoly, credentials]);

  const confirmCancelOrder = useCancelOrderResultConfirmation();
  const cancelResultMessages = useMemo(
    () => getCancelOrderConfirmationMessages(t, i18n),
    [i18n, t],
  );

  const cancelMutation = useCancelOrder(
    cancelGetHeaders,
    {
      onSuccess: (_data, vars) => {
        void confirmCancelOrder({
          source: vars.source,
          user: walletAddress,
          kalshiUser: source === "kalshi" ? walletAddress : undefined,
          polymarketUser: source === "polymarket" ? walletAddress : undefined,
          orderId: vars.id,
          messages: cancelResultMessages,
          getOrdersHeaders: polymarketGetHeaders,
        });
      },
      onError: () => toast.error(t("extend.portfolio.cancelFailed")),
    },
  );

  const credentialsReady = !isPoly || !!polymarketGetHeaders;
  const { data, isLoading: queryLoading } = useOrdersMulti(
    {
      kalshi_user: source === "kalshi" ? walletAddress : undefined,
      polymarket_user: source === "polymarket" ? walletAddress : undefined,
    },
    isPoly ? { getHeaders: polymarketGetHeaders } : undefined,
    { enabled: credentialsReady && Boolean(walletAddress), refetchInterval: false },
  );
  const isLoading = queryLoading || !credentialsReady;

  const orders = useMemo(() => {
    const all = data?.orders ?? [];
    const openStatuses = new Set(["live", "open", "submitted", "pending"]);
    let filtered = all.filter((o) => openStatuses.has(o.status));
    if (marketSlugs.length > 0) {
      const slugSet = new Set(marketSlugs);
      filtered = filtered.filter((o) => {
        const slug = o.market?.slug ?? o.market_id;
        return !slug || slugSet.has(slug);
      });
    }
    return filtered;
  }, [data, marketSlugs]);
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

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  if (isLoading) return <PanelSkeleton />;
  if (orders.length === 0) return <EmptyState message={t("extend.portfolio.noOrders")} />;

  return (
    <div
      ref={parentRef}
      className="mt-4 overflow-auto rounded-xl border border-zinc-800/30 bg-zinc-900/20"
      style={{ maxHeight: LIST_HEIGHT }}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vItem) => {
	          const order = orders[vItem.index];
	          const isBuy = order.side === "BUY";
	          const display = activityDisplay(order, worldcupMatchBySlug, translate);
	          const imageUrl = display.imageUrl;
	          const title = display.title;
	          const subtitle = display.subtitle;
	          const canCancel = !order.status || !({ matched: 1, cancelled: 1, invalid: 1, closed: 1, failed: 1, expired: 1 } as Record<string, number>)[order.status];

          return (
            <div
              key={order.id}
              ref={virtualizer.measureElement}
              data-index={vItem.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${vItem.start}px)` }}
            >
              <div className={cn("group transition-[background-color] duration-150 hover:bg-zinc-800/30", vItem.index < orders.length - 1 && "border-b border-zinc-800/30")}>
                {/* Desktop */}
                <div className="hidden items-center gap-4 px-5 py-4 lg:flex">
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
                    <span className={cn("mb-1 line-clamp-1 text-sm font-medium text-white", order.event?.slug && "cursor-pointer hover:underline")} onClick={() => handleNavigate(order)}>
                      {title}
                    </span>
                    {subtitle && (
                      <span className="mb-0.5 line-clamp-1 text-xs text-zinc-400">
                        {subtitle}
                      </span>
                    )}
                    {SHOW_SOURCE_BADGE && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        {source === "kalshi" ? <KalshiIcon width={36} height={12} /> : <><PolymarketIcon width={14} height={14} /><span>Polymarket</span></>}
                      </div>
                    )}
                  </div>
                  <div className="min-w-[100px] shrink-0 text-center">
                    <span className={cn("inline-block rounded px-2 py-1 text-xs font-semibold", isBuy ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish")}>
                      {order.side} {order.outcome ? <span className="capitalize">{order.outcome}</span> : null}
                    </span>
                  </div>
                  <div className="min-w-[80px] shrink-0 text-right">
                    <div className="text-[10px] text-zinc-500">{t("extend.portfolio.price")}</div>
                    <div className="font-mono text-sm font-medium text-white">{order.price ? formatPrice(parseFloat(order.price)) : "—"}</div>
                  </div>
                  <div className="min-w-[100px] shrink-0 text-right">
                    <div className="text-[10px] text-zinc-500">{t("extend.portfolio.filledTotal")}</div>
                    <div className="font-mono text-sm font-medium text-white">{order.size_matched ?? "0"}<span className="text-zinc-500">/{order.original_size ?? "—"}</span></div>
                  </div>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => handleCancel(order)}
                      disabled={cancelMutation.isPending}
                      className="w-[72px] shrink-0 inline-flex items-center justify-center gap-1.5 cursor-pointer rounded-lg border border-red-500/30 bg-red-500/10 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {t("extend.portfolio.cancel")}
                    </button>
                  )}
                </div>
                {/* Mobile */}
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
                    <span className={cn("truncate text-sm font-medium text-white block", order.event?.slug && "cursor-pointer hover:underline")} onClick={() => handleNavigate(order)}>
                      {title}
                    </span>
                    {subtitle && (
                      <span className="mt-0.5 block truncate text-xs text-zinc-400">
                        {subtitle}
                      </span>
                    )}
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                      <span className={cn("rounded px-1.5 py-0.5 font-semibold", isBuy ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish")}>
                        {order.side} {order.outcome ? <span className="capitalize">{order.outcome}</span> : null}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-medium text-white">{order.price ? formatPrice(parseFloat(order.price)) : "—"}</div>
                    <div className="font-mono text-xs text-zinc-400">{order.size_matched ?? "0"}<span className="text-zinc-600">/{order.original_size ?? "—"}</span></div>
                  </div>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => handleCancel(order)}
                      disabled={cancelMutation.isPending}
                      className="inline-flex shrink-0 items-center justify-center cursor-pointer rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 disabled:opacity-50"
                    >
                      {t("extend.portfolio.cancel")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trades (history) panel (matching PredictPortfolioPage.TradeRow style)
// ---------------------------------------------------------------------------

function EventTradesPanel({
  source,
  walletAddress,
  marketSlugs,
}: {
  source: ProviderSource;
  walletAddress: string;
  marketSlugs: string[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const translate = t as WorldCupTranslate;

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteTrades({ source, wallet: walletAddress, limit: 50 });

  const trades = useMemo(() => {
    const all = data?.pages?.flatMap((p) => p.items) ?? [];
    if (marketSlugs.length === 0) return all;
    const slugSet = new Set(marketSlugs);
    return all.filter((t) => t.market && slugSet.has(t.market.slug));
  }, [data?.pages, marketSlugs]);
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
    if (last.index >= trades.length - 5 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), trades.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleNavigate = useCallback(
    (trade: PredictTrade) => {
      if (trade.event?.slug) {
        router.push(predictEventHref({ slug: trade.event.slug, source: trade.source }));
      }
    },
    [router],
  );

  if (isLoading) return <PanelSkeleton />;
  if (trades.length === 0) return <EmptyState message={t("extend.portfolio.noTrades")} />;

  return (
    <div
      ref={parentRef}
      className="mt-4 overflow-auto rounded-xl border border-zinc-800/30 bg-zinc-900/20"
      style={{ maxHeight: LIST_HEIGHT }}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const trade = trades[vItem.index];
          const isRedeem = trade.type === "REDEEM";
          const isBuy = trade.side?.toUpperCase() === "BUY";
          const timeStr = formatTimestamp(trade.timestamp);
	          const price = trade.price ?? 0;
	          const usdSize = trade.usd_size ?? 0;
	          const display = activityDisplay(trade, worldcupMatchBySlug, translate);
	          const eventTitle = display.title;
	          const marketQuestion = display.subtitle;
	          const outcomeLabel = trade.outcome ?? "—";
	          const tradeImageUrl = display.imageUrl;

          return (
            <div
              key={trade.id ?? vItem.index}
              ref={virtualizer.measureElement}
              data-index={vItem.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${vItem.start}px)` }}
            >
              <div className={cn("group transition-[background-color] duration-150 hover:bg-zinc-800/30", vItem.index < trades.length - 1 && "border-b border-zinc-800/30")}>
                {/* Desktop */}
                <div className="hidden items-center gap-4 px-5 py-4 lg:flex">
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
                          className={cn("mb-0.5 line-clamp-1 text-sm font-medium text-white", trade.event?.slug && "cursor-pointer hover:underline")}
                          onClick={() => handleNavigate(trade)}
                        >
                          {eventTitle || marketQuestion}
                        </span>
                      )}
                      {eventTitle && marketQuestion && eventTitle !== marketQuestion && (
                        <span className="mb-0.5 line-clamp-1 text-xs text-zinc-400">{marketQuestion}</span>
                      )}
                      {SHOW_SOURCE_BADGE && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            {source === "kalshi" ? <KalshiIcon width={36} height={12} /> : <><PolymarketIcon width={14} height={14} /><span className="text-zinc-500">Polymarket</span></>}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="min-w-[120px] shrink-0 text-center">
                    <span className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-semibold", isRedeem ? "bg-primary/10 text-primary" : isBuy ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish")}>
                      {isRedeem ? t("predict.profile.redeem") : trade.side}
                      {outcomeLabel !== "—" && <span className="capitalize"> {outcomeLabel}</span>}
                    </span>
                  </div>
                  <div className="min-w-[160px] shrink-0 text-right">
                    {isRedeem ? (
                      <>
                        {trade.size > 0 && (
                          <div className="font-mono text-xs text-zinc-400">
                            {formatShares(trade.size)}{t("predict.trade.sharesUnit")}
                          </div>
                        )}
                        <div className="text-base font-bold text-white">
                          {usdSize > 0 ? `+$${usdSize.toFixed(2)}` : "$0.00"}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-mono text-xs text-zinc-400">
                          {formatPrice(price)} &times; {formatShares(trade.size)}{t("predict.trade.sharesUnit")}
                        </div>
                        <div className="text-base font-bold text-white">${usdSize.toFixed(2)}</div>
                      </>
                    )}
                  </div>
                  <div className="min-w-[80px] shrink-0 text-right">
                    <span className="whitespace-nowrap text-xs text-zinc-500">{timeStr}</span>
                  </div>
                </div>
                {/* Mobile */}
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
                      <span className={cn("truncate text-sm font-medium text-white block", trade.event?.slug && "cursor-pointer hover:underline")} onClick={() => handleNavigate(trade)}>
                        {eventTitle || marketQuestion}
                      </span>
                    )}
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                      <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold", isRedeem ? "bg-primary/10 text-primary" : isBuy ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish")}>
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
            </div>
          );
        })}
      </div>
      {isFetchingNextPage && (
        <div className="flex justify-center border-t border-zinc-800/30 py-3">
          <span className="text-xs text-zinc-500">{t("extend.portfolio.loadMore")}...</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <EmptyIcon width={32} height={32} className="text-zinc-600" />
      <span className="text-sm text-zinc-500">{message}</span>
    </div>
  );
}

function SignInPrompt({
  message,
  buttonLabel,
  onSignIn,
}: {
  message: string;
  buttonLabel: string;
  onSignIn: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <EmptyIcon width={32} height={32} className="text-zinc-600" />
      <span className="text-sm text-zinc-500">{message}</span>
      <button
        type="button"
        onClick={onSignIn}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#c7ff2e]/25 bg-[#c7ff2e]/10 px-4 py-2 text-sm font-semibold text-[#c7ff2e] transition-colors duration-200 hover:border-[#c7ff2e]/40 hover:bg-[#c7ff2e]/20 cursor-pointer"
      >
        <SignInIcon width={14} height={14} />
        {buttonLabel}
      </button>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800/30 bg-zinc-900/20">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ borderBottom: i < 3 ? "1px solid rgba(39,39,42,0.3)" : "none" }}>
          <div className="hidden items-center gap-3 px-5 py-4 lg:flex">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-zinc-800/50" />
            <div className="flex-1">
              <div className="mb-2 h-3.5 w-3/5 animate-pulse rounded bg-zinc-800/50" />
              <div className="h-2.5 w-2/5 animate-pulse rounded bg-zinc-800/50" />
            </div>
            <div className="h-5 w-[72px] shrink-0 animate-pulse rounded bg-zinc-800/50" />
          </div>
          <div className="flex items-center gap-3 p-4 lg:hidden">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-zinc-800/50" />
            <div className="flex-1">
              <div className="mb-1.5 h-3.5 w-4/5 animate-pulse rounded bg-zinc-800/50" />
              <div className="h-2.5 w-2/5 animate-pulse rounded bg-zinc-800/50" />
            </div>
            <div className="h-3.5 w-14 shrink-0 animate-pulse rounded bg-zinc-800/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

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
