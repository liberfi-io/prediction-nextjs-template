"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "@liberfi.io/i18n";
import { Chain } from "@liberfi.io/types";
import { useAuth, useConnectedWallet } from "@liberfi.io/wallet-connector";
import { usePredictWallet } from "@liberfi.io/ui-predict";
import {
  usePositions,
  useInfiniteOrders,
  useInfiniteTrades,
  useCancelOrder,
  type PredictPosition,
  type PredictOrder,
  type PredictTrade,
  type OrderStatus,
} from "@liberfi.io/react-predict";
import {
  cn,
  Skeleton,
  SignInIcon,
  UsdcIcon,
  PolymarketIcon,
  KalshiIcon,
  SolanaIcon,
} from "@liberfi.io/ui";
import { Button } from "@heroui/react";

type PortfolioTab = "positions" | "orders" | "trades";

export function PredictPortfolioPage() {
  const { t } = useTranslation();
  const { status: authStatus, signIn } = useAuth();
  const isAuthenticated = authStatus === "authenticated";

  if (!isAuthenticated) {
    return <SignInPrompt onSignIn={signIn} />;
  }

  return <PortfolioContent />;
}

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 px-4">
      <p className="text-lg text-neutral">{t("extend.portfolio.signInPrompt")}</p>
      <Button
        color="primary"
        radius="full"
        onPress={onSignIn}
        startContent={<SignInIcon width={16} height={16} />}
      >
        {t("common.signIn")}
      </Button>
    </div>
  );
}

function PortfolioContent() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PortfolioTab>("positions");

  const solanaWallet = useConnectedWallet(Chain.SOLANA);
  const evmWallet = useConnectedWallet(Chain.POLYGON);
  const solanaAddr = solanaWallet?.address ?? "";
  const evmAddr = evmWallet?.address ?? "";

  const tabs: { key: PortfolioTab; label: string }[] = [
    { key: "positions", label: t("extend.portfolio.positions") },
    { key: "orders", label: t("extend.portfolio.openOrders") },
    { key: "trades", label: t("extend.portfolio.tradeHistory") },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 max-sm:px-2 py-4 max-w-[1200px] mx-auto w-full">
      <BalanceOverview />

      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap",
              activeTab === tab.key
                ? "text-foreground border-b-2 border-primary"
                : "text-neutral hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === "positions" && (
          <PositionsPanel solanaAddr={solanaAddr} evmAddr={evmAddr} />
        )}
        {activeTab === "orders" && (
          <OrdersPanel solanaAddr={solanaAddr} evmAddr={evmAddr} />
        )}
        {activeTab === "trades" && (
          <TradesPanel solanaAddr={solanaAddr} evmAddr={evmAddr} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Balance overview
// ---------------------------------------------------------------------------

function BalanceOverview() {
  const { t } = useTranslation();
  const { dflowUsdcBalance, polymarketUsdcBalance, isLoading } = usePredictWallet();
  const totalBalance = dflowUsdcBalance + polymarketUsdcBalance;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6 p-4 rounded-xl border border-border bg-content1">
      <div className="flex items-center gap-3 flex-1">
        <UsdcIcon width={28} height={28} className="shrink-0" />
        <div className="flex flex-col">
          <span className="text-xs text-neutral">{t("extend.portfolio.totalBalance")}</span>
          {isLoading ? (
            <Skeleton className="h-7 w-24 rounded-md" />
          ) : (
            <span className="text-xl font-bold tabular-nums">${formatUsdc(totalBalance)}</span>
          )}
        </div>
      </div>

      <div className="flex gap-4 sm:gap-6">
        <BalanceChip
          icon={<PolymarketIcon width={16} height={16} />}
          label="Polymarket"
          chainIcon={<PolygonIcon size={12} />}
          chainName="Polygon"
          balance={polymarketUsdcBalance}
          isLoading={isLoading}
        />
        <BalanceChip
          icon={<KalshiIcon width={46} height={14} />}
          label="Kalshi"
          chainIcon={<SolanaIcon width={12} height={12} />}
          chainName="Solana"
          balance={dflowUsdcBalance}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

function BalanceChip({
  icon,
  label,
  chainIcon,
  chainName,
  balance,
  isLoading,
}: {
  icon: React.ReactNode;
  label: string;
  chainIcon: React.ReactNode;
  chainName: string;
  balance: number;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-xs text-neutral">
        {icon}
        <span className="max-sm:hidden">{label}</span>
        <span className="flex items-center gap-0.5 text-[10px]">
          {chainIcon} {chainName}
        </span>
      </span>
      {isLoading ? (
        <Skeleton className="h-5 w-16 rounded-md" />
      ) : (
        <span className="text-sm font-semibold tabular-nums">${formatUsdc(balance)}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Positions panel
// ---------------------------------------------------------------------------

function PositionsPanel({ solanaAddr, evmAddr }: { solanaAddr: string; evmAddr: string }) {
  const { t } = useTranslation();

  const { data: kalshiData, isLoading: kalshiLoading } = usePositions({
    source: "kalshi",
    user: solanaAddr,
  });
  const { data: polyData, isLoading: polyLoading } = usePositions({
    source: "polymarket",
    user: evmAddr,
  });

  const isLoading = kalshiLoading || polyLoading;
  const positions = useMemo(() => {
    const all: PredictPosition[] = [];
    if (kalshiData?.positions) all.push(...kalshiData.positions);
    if (polyData?.positions) all.push(...polyData.positions);
    return all;
  }, [kalshiData, polyData]);

  if (isLoading) return <PanelSkeleton />;
  if (positions.length === 0) return <EmptyState message={t("extend.portfolio.noPositions")} />;

  return (
    <div className="flex flex-col gap-2">
      {/* Desktop table header */}
      <div className="hidden lg:flex items-center text-neutral text-xs font-normal py-2 border-b border-border/50">
        <div className="flex-[3] min-w-0 pr-2">{t("predict.positions.event")}</div>
        <div className="flex-1 pr-2 text-right">{t("predict.positions.totalSize")}</div>
        <div className="flex-1 pr-2 text-right">{t("predict.positions.avgPrice")}</div>
        <div className="flex-1 pr-2 text-right">{t("predict.positions.markPrice")}</div>
        <div className="flex-[1.5] pr-2 text-right">{t("predict.positions.pnl")}</div>
        <div className="flex-1 pr-2 text-right">{t("predict.positions.payoutIfRight")}</div>
      </div>

      {positions.map((pos, i) => (
        <PositionRow key={`${pos.market?.slug ?? i}`} position={pos} />
      ))}
    </div>
  );
}

function PositionRow({ position }: { position: PredictPosition }) {
  const pnl = position.pnl ?? 0;
  const pnlPercent = position.pnl_percent ?? 0;
  const avgPrice = position.avg_price ?? 0;
  const currentPrice = position.current_price ?? 0;
  const pnlColor = pnl > 0 ? "text-success" : pnl < 0 ? "text-danger" : "text-foreground";
  const pnlSign = pnl > 0 ? "+" : "";
  const marketLabel = position.market?.outcomes?.[0]?.label ?? position.market?.question ?? "—";
  const sideLabel = position.side;
  const payoutIfRight = position.size;

  return (
    <>
      {/* Desktop row */}
      <div className="hidden lg:flex items-center py-2.5 border-b border-border/50 hover:bg-content2/40 transition-colors text-sm">
        <div className="flex-[3] min-w-0 pr-2">
          <div className="flex flex-col gap-y-0.5">
            <span className="text-foreground truncate font-medium">{marketLabel}</span>
            <span className={cn("text-[10px] font-medium", sideLabel.toLowerCase() === "yes" ? "text-primary" : "text-secondary")}>
              {sideLabel}
            </span>
          </div>
        </div>
        <div className="flex-1 pr-2 text-right font-mono text-foreground">{position.size}</div>
        <div className="flex-1 pr-2 text-right font-mono text-foreground">{formatPrice(avgPrice)}</div>
        <div className="flex-1 pr-2 text-right font-mono text-foreground">{formatPrice(currentPrice)}</div>
        <div className={cn("flex-[1.5] pr-2 text-right font-mono", pnlColor)}>
          {pnlSign}${Math.abs(pnl).toFixed(2)}
          <span className="text-[10px] ml-0.5 opacity-70">({pnlSign}{pnlPercent.toFixed(1)}%)</span>
        </div>
        <div className="flex-1 pr-2 text-right font-mono text-foreground">${payoutIfRight.toFixed(2)}</div>
      </div>

      {/* Mobile card */}
      <div className="lg:hidden rounded-lg border border-border bg-content1 p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-foreground line-clamp-2">{marketLabel}</span>
          <span className={cn("shrink-0 text-xs font-medium px-1.5 py-0.5 rounded",
            sideLabel.toLowerCase() === "yes" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
          )}>
            {sideLabel}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex flex-col">
            <span className="text-neutral">Size</span>
            <span className="font-mono text-foreground">{position.size}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-neutral">Price</span>
            <span className="font-mono text-foreground">{formatPrice(currentPrice)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-neutral">PnL</span>
            <span className={cn("font-mono", pnlColor)}>
              {pnlSign}${Math.abs(pnl).toFixed(2)} ({pnlSign}{pnlPercent.toFixed(1)}%)
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-neutral">Payout</span>
            <span className="font-mono text-foreground">${payoutIfRight.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Orders panel
// ---------------------------------------------------------------------------

function OrdersPanel({ solanaAddr, evmAddr }: { solanaAddr: string; evmAddr: string }) {
  const { t } = useTranslation();
  const cancelMutation = useCancelOrder();

  const { data: kalshiOrders, isLoading: kalshiLoading, fetchNextPage: fetchNextKalshi, hasNextPage: hasMoreKalshi } =
    useInfiniteOrders({ source: "kalshi", wallet_address: solanaAddr });
  const { data: polyOrders, isLoading: polyLoading, fetchNextPage: fetchNextPoly, hasNextPage: hasMorePoly } =
    useInfiniteOrders({ source: "polymarket", wallet_address: evmAddr });

  const isLoading = kalshiLoading || polyLoading;

  const orders = useMemo(() => {
    const all: PredictOrder[] = [];
    const openStatuses = new Set(["live", "open", "submitted", "pending"]);
    if (kalshiOrders?.pages) {
      all.push(...kalshiOrders.pages.flatMap((p) => p.items).filter((o) => openStatuses.has(o.status)));
    }
    if (polyOrders?.pages) {
      all.push(...polyOrders.pages.flatMap((p) => p.items).filter((o) => openStatuses.has(o.status)));
    }
    return all;
  }, [kalshiOrders, polyOrders]);

  const handleCancel = useCallback(
    (order: PredictOrder) => {
      cancelMutation.mutate({ source: order.source, id: order.id });
    },
    [cancelMutation],
  );

  const handleLoadMore = useCallback(() => {
    if (hasMoreKalshi) fetchNextKalshi();
    if (hasMorePoly) fetchNextPoly();
  }, [hasMoreKalshi, hasMorePoly, fetchNextKalshi, fetchNextPoly]);

  if (isLoading) return <PanelSkeleton />;
  if (orders.length === 0) return <EmptyState message={t("extend.portfolio.noOrders")} />;

  return (
    <div className="flex flex-col gap-2">
      {/* Desktop table header */}
      <div className="hidden lg:flex items-center text-neutral text-xs font-normal py-2 border-b border-border/50">
        <div className="w-16 shrink-0 pr-2">Side</div>
        <div className="flex-1 pr-2">Outcome</div>
        <div className="flex-1 pr-2">Type</div>
        <div className="flex-1 pr-2 text-right">Price</div>
        <div className="flex-1 pr-2 text-right">Filled</div>
        <div className="w-20 shrink-0 pr-2">Status</div>
        <div className="w-16 shrink-0" />
      </div>

      {orders.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          onCancel={handleCancel}
          isCancelling={cancelMutation.isPending}
        />
      ))}

      {(hasMoreKalshi || hasMorePoly) && (
        <button
          type="button"
          onClick={handleLoadMore}
          className="text-sm text-primary hover:text-primary/80 py-2 cursor-pointer"
        >
          Load more
        </button>
      )}
    </div>
  );
}

function OrderRow({
  order,
  onCancel,
  isCancelling,
}: {
  order: PredictOrder;
  onCancel: (order: PredictOrder) => void;
  isCancelling: boolean;
}) {
  const isBuy = order.side === "BUY";

  return (
    <>
      {/* Desktop row */}
      <div className="hidden lg:flex items-center py-2.5 border-b border-border/50 text-sm">
        <div className="w-16 shrink-0 pr-2">
          <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
            isBuy ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"
          )}>
            {order.side}
          </span>
        </div>
        <div className="flex-1 pr-2 text-foreground capitalize">{order.outcome ?? "—"}</div>
        <div className="flex-1 pr-2 text-neutral capitalize">{order.order_type ?? "limit"}</div>
        <div className="flex-1 pr-2 text-right font-mono text-foreground">
          {order.price ? formatPrice(parseFloat(order.price)) : "—"}
        </div>
        <div className="flex-1 pr-2 text-right font-mono text-foreground">
          {order.size_matched ?? "0"}/{order.original_size ?? "—"}
        </div>
        <div className="w-20 shrink-0 pr-2">
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="w-16 shrink-0 text-right">
          <button
            type="button"
            onClick={() => onCancel(order)}
            disabled={isCancelling}
            className="text-[10px] text-danger hover:text-danger/80 cursor-pointer disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Mobile card */}
      <div className="lg:hidden rounded-lg border border-border bg-content1 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded",
              isBuy ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"
            )}>
              {order.side}
            </span>
            <span className="text-sm text-foreground capitalize">{order.outcome ?? "—"}</span>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex flex-col">
            <span className="text-neutral">Price</span>
            <span className="font-mono text-foreground">{order.price ? formatPrice(parseFloat(order.price)) : "—"}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-neutral">Filled</span>
            <span className="font-mono text-foreground">{order.size_matched ?? "0"}/{order.original_size ?? "—"}</span>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => onCancel(order)}
            disabled={isCancelling}
            className="text-xs text-danger hover:text-danger/80 cursor-pointer disabled:opacity-50 border border-border rounded px-2 py-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const colorMap: Record<string, string> = {
    live: "bg-success/10 text-success",
    open: "bg-success/10 text-success",
    submitted: "bg-warning/10 text-warning",
    pending: "bg-warning/10 text-warning",
    matched: "bg-primary/10 text-primary",
    cancelled: "bg-neutral/10 text-neutral",
    failed: "bg-danger/10 text-danger",
    expired: "bg-neutral/10 text-neutral",
  };

  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
      colorMap[status] ?? "bg-neutral/10 text-neutral"
    )}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Trades panel
// ---------------------------------------------------------------------------

function TradesPanel({ solanaAddr, evmAddr }: { solanaAddr: string; evmAddr: string }) {
  const { t } = useTranslation();

  const { data: kalshiTrades, isLoading: kalshiLoading, fetchNextPage: fetchNextKalshi, hasNextPage: hasMoreKalshi } =
    useInfiniteTrades({ source: "kalshi", wallet: solanaAddr, limit: 50 });
  const { data: polyTrades, isLoading: polyLoading, fetchNextPage: fetchNextPoly, hasNextPage: hasMorePoly } =
    useInfiniteTrades({ source: "polymarket", wallet: evmAddr, limit: 50 });

  const isLoading = kalshiLoading || polyLoading;

  const trades = useMemo(() => {
    const all: PredictTrade[] = [];
    if (kalshiTrades?.pages) all.push(...kalshiTrades.pages.flatMap((p) => p.items));
    if (polyTrades?.pages) all.push(...polyTrades.pages.flatMap((p) => p.items));
    all.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    return all;
  }, [kalshiTrades, polyTrades]);

  const handleLoadMore = useCallback(() => {
    if (hasMoreKalshi) fetchNextKalshi();
    if (hasMorePoly) fetchNextPoly();
  }, [hasMoreKalshi, hasMorePoly, fetchNextKalshi, fetchNextPoly]);

  if (isLoading) return <PanelSkeleton />;
  if (trades.length === 0) return <EmptyState message={t("extend.portfolio.noTrades")} />;

  return (
    <div className="flex flex-col gap-2">
      {/* Desktop table header */}
      <div className="hidden lg:flex items-center text-neutral text-xs font-normal py-2 border-b border-border/50">
        <div className="w-16 shrink-0 pr-2">Side</div>
        <div className="flex-1 pr-2">Outcome</div>
        <div className="flex-1 pr-2 text-right">Price</div>
        <div className="flex-1 pr-2 text-right">Qty</div>
        <div className="flex-1 pr-2 text-right">Total</div>
        <div className="flex-[1.5] pr-2 text-right">Time</div>
      </div>

      {trades.map((trade, i) => (
        <TradeRow key={`${trade.id ?? i}`} trade={trade} />
      ))}

      {(hasMoreKalshi || hasMorePoly) && (
        <button
          type="button"
          onClick={handleLoadMore}
          className="text-sm text-primary hover:text-primary/80 py-2 cursor-pointer"
        >
          Load more
        </button>
      )}
    </div>
  );
}

function TradeRow({ trade }: { trade: PredictTrade }) {
  const isBuy = trade.side?.toUpperCase() === "BUY";
  const timeStr = formatTimestamp(trade.timestamp);
  const price = trade.price ?? 0;
  const usdSize = trade.usd_size ?? 0;

  return (
    <>
      {/* Desktop row */}
      <div className="hidden lg:flex items-center py-2.5 border-b border-border/50 text-sm">
        <div className="w-16 shrink-0 pr-2">
          <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
            isBuy ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"
          )}>
            {trade.side}
          </span>
        </div>
        <div className="flex-1 pr-2 text-foreground capitalize">{trade.outcome ?? "—"}</div>
        <div className="flex-1 pr-2 text-right font-mono text-foreground">{formatPrice(price)}</div>
        <div className="flex-1 pr-2 text-right font-mono text-foreground">{trade.size}</div>
        <div className="flex-1 pr-2 text-right font-mono text-foreground">${usdSize.toFixed(2)}</div>
        <div className="flex-[1.5] pr-2 text-right text-neutral whitespace-nowrap">{timeStr}</div>
      </div>

      {/* Mobile card */}
      <div className="lg:hidden rounded-lg border border-border bg-content1 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded",
              isBuy ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"
            )}>
              {trade.side}
            </span>
            <span className="text-sm text-foreground capitalize">{trade.outcome ?? "—"}</span>
          </div>
          <span className="text-[11px] text-neutral">{timeStr}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex flex-col">
            <span className="text-neutral">Price</span>
            <span className="font-mono text-foreground">{formatPrice(price)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-neutral">Qty</span>
            <span className="font-mono text-foreground">{trade.size}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-neutral">Total</span>
            <span className="font-mono text-foreground">${usdSize.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center text-sm text-neutral py-24">
      {message}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

function PolygonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 33" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Polygon">
      <path d="M29 10.2a2.2 2.2 0 0 0-2.1 0l-4.8 2.8-3.3 1.9-4.8 2.8a2.2 2.2 0 0 1-2.1 0l-3.8-2.2a2.1 2.1 0 0 1-1.1-1.9V9.5c0-.8.4-1.5 1.1-1.9l3.8-2.1a2.2 2.2 0 0 1 2.1 0l3.8 2.1c.7.4 1.1 1.1 1.1 1.9v2.8l3.3-1.9V7.6a2.1 2.1 0 0 0-1.1-1.9L16.1.5a2.2 2.2 0 0 0-2.1 0L7.1 4.4a2 2 0 0 0-.5.4L6.4 5A2.1 2.1 0 0 0 6 6.4v9.9c0 .8.4 1.5 1.1 1.9l6.9 4a2.2 2.2 0 0 0 2.1 0l4.8-2.7 3.3-1.9 4.8-2.8a2.2 2.2 0 0 1 2.1 0l3.8 2.2c.7.4 1.1 1.1 1.1 1.9v4a2.1 2.1 0 0 1-1.1 1.8l-3.7 2.2a2.2 2.2 0 0 1-2.1 0l-3.8-2.2a2.1 2.1 0 0 1-1.1-1.9v-2.8l-3.3 1.9v2.8c0 .8.4 1.5 1.1 1.9l6.9 4a2.2 2.2 0 0 0 2.1 0l6.9-4a2.1 2.1 0 0 0 1.1-1.9v-8c0-.8-.4-1.5-1.1-1.9L29 10.2Z" fill="#8247E5" />
    </svg>
  );
}

function formatUsdc(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
