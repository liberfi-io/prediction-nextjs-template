"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { Chain } from "@liberfi.io/types";
import { useAuth, useConnectedWallet } from "@liberfi.io/wallet-connector";
import {
  usePredictWallet,
  PredictTradeModal,
  PREDICT_TRADE_MODAL_ID,
  type PredictTradeModalParams,
} from "@liberfi.io/ui-predict";
import {
  usePositionsMulti,
  useInfiniteOrders,
  useInfiniteTrades,
  useCancelOrder,
  usePolymarket,
  buildPolymarketL2Headers,
  type PredictPosition,
  type PredictOrder,
  type PredictTrade,
  type OrderStatus,
} from "@liberfi.io/react-predict";
import {
  cn,
  Skeleton,
  UsdcIcon,
  PolymarketIcon,
  KalshiIcon,
  ChartLineIcon,
} from "@liberfi.io/ui";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FUND_WALLET_MODAL_ID } from "../FundWalletModal";
import { predictEventHref } from "./predict-source";

type PortfolioTab = "positions" | "orders" | "history";

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export function PredictPortfolioPage() {
  const { status: authStatus, signIn } = useAuth();

  const signInRef = useRef(signIn);
  signInRef.current = signIn;
  const didTriggerSignIn = useRef(false);
  useEffect(() => {
    if (authStatus === "unauthenticated" && !didTriggerSignIn.current) {
      didTriggerSignIn.current = true;
      queueMicrotask(() => signInRef.current());
    }
  }, [authStatus]);

  return (
    <div className="min-h-screen bg-zinc-950/50 pb-20 lg:pb-8">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        {authStatus === "authenticated" ? <PortfolioContent /> : <PortfolioSkeleton />}
      </div>
      <PredictTradeModal />
    </div>
  );
}

function PortfolioSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t("extend.portfolio.title")}
        </h1>
      </div>
      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
            <Skeleton className="mb-2 h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      {/* Tab bar */}
      <div className="mb-4 flex gap-4 border-b border-zinc-800/60 pb-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
      </div>
      {/* Rows */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
          >
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main content (authenticated)
// ---------------------------------------------------------------------------

function PortfolioContent() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PortfolioTab>("positions");

  const solanaWallet = useConnectedWallet(Chain.SOLANA);
  const evmWallet = useConnectedWallet(Chain.POLYGON);
  const solanaAddr = solanaWallet?.address ?? "";
  const evmAddr = evmWallet?.address ?? "";

  const { data: positionsData, isLoading: positionsLoading } = usePositionsMulti({
    kalshi_user: solanaAddr || undefined,
    polymarket_user: evmAddr || undefined,
  });

  const allPositions = positionsData?.positions ?? [];
  const positionsCount = allPositions.length;

  const { kalshiUsdcBalance, polymarketUsdcBalance, isLoading: balanceLoading } = usePredictWallet();

  const totalBuyingPower = (kalshiUsdcBalance ?? 0) + (polymarketUsdcBalance ?? 0);
  const investedValue = useMemo(() => {
    let total = 0;
    for (const p of allPositions) {
      total += p.current_value ?? p.size * (p.current_price ?? 0);
    }
    return total;
  }, [allPositions]);
  const totalNetWorth = totalBuyingPower + investedValue;

  const allTimePnl = useMemo(() => {
    let pnl = 0;
    for (const p of allPositions) {
      pnl += p.pnl ?? 0;
    }
    return pnl;
  }, [allPositions]);

  const heroLoading = balanceLoading || positionsLoading;

  const tabs: { key: PortfolioTab; label: string }[] = [
    {
      key: "positions",
      label:
        positionsCount > 0
          ? `${t("extend.portfolio.positions")} (${positionsCount})`
          : t("extend.portfolio.positions"),
    },
    { key: "orders", label: t("extend.portfolio.openOrders") },
    { key: "history", label: t("extend.portfolio.tradeHistory") },
  ];

  return (
    <>
      {/* Title row */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t("extend.portfolio.title")}
        </h1>
      </div>

      {/* Hero cards — 3-col grid */}
      <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Total Net Worth (spans 2 cols) */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-900/50 p-6 sm:p-8 lg:col-span-2">
          <div className="pointer-events-none absolute -mr-16 -mt-16 right-0 top-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative z-10">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-zinc-400">
                  <span className="text-sm font-medium">{t("extend.portfolio.totalNetWorth")}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  {heroLoading ? (
                    <Skeleton className="h-12 w-40 rounded-lg bg-zinc-800/60" />
                  ) : (
                    <span className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                      ${formatUsdc(totalNetWorth)}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium",
                      allTimePnl >= 0
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400",
                    )}
                  >
                    {allTimePnl >= 0 ? (
                      <TrendingUpIcon className="h-4 w-4" />
                    ) : (
                      <TrendingDownIcon className="h-4 w-4" />
                    )}
                    <span>
                      {allTimePnl >= 0 ? "+" : ""}${formatUsdc(Math.abs(allTimePnl))}
                    </span>
                  </span>
                  <span className="text-sm text-zinc-500">{t("extend.portfolio.allTimePnl")}</span>
                </div>
              </div>
              <div className="flex gap-2 sm:gap-3">
                <FundWalletButton />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Buying Power + Invested Assets */}
        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 p-5 transition-colors hover:bg-zinc-900/80">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-400">
                <UsdcIcon width={16} height={16} className="opacity-70" />
                <span className="text-sm font-medium">{t("extend.portfolio.buyingPower")}</span>
              </div>
            </div>
            {heroLoading ? (
              <Skeleton className="h-8 w-24 rounded-lg bg-zinc-800/60" />
            ) : (
              <div className="text-2xl font-bold text-white">${formatUsdc(totalBuyingPower)}</div>
            )}
          </div>
          <div className="flex-1 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 p-5 transition-colors hover:bg-zinc-900/80">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-400">
                <ChartLineIcon width={16} height={16} className="text-blue-400 opacity-70" />
                <span className="text-sm font-medium">{t("extend.portfolio.investedAssets")}</span>
              </div>
              {positionsCount > 0 && (
                <span className="text-xs text-zinc-500">
                  {positionsCount} {positionsCount === 1 ? "position" : "positions"}
                </span>
              )}
            </div>
            {heroLoading ? (
              <Skeleton className="h-8 w-24 rounded-lg bg-zinc-800/60" />
            ) : (
              <div className="text-2xl font-bold text-white">${formatUsdc(investedValue)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800/50">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-all",
                activeTab === tab.key
                  ? "border-white text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-300",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        {activeTab === "positions" && (
          <PositionsPanel positions={allPositions} isLoading={positionsLoading} />
        )}
        {activeTab === "orders" && <OrdersPanel solanaAddr={solanaAddr} evmAddr={evmAddr} />}
        {activeTab === "history" && <TradesPanel solanaAddr={solanaAddr} evmAddr={evmAddr} />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Fund Wallet button
// ---------------------------------------------------------------------------

function FundWalletButton() {
  const { t } = useTranslation();
  const { onOpen } = useAsyncModal(FUND_WALLET_MODAL_ID);

  return (
    <button
      type="button"
      onClick={() => onOpen()}
      className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-400 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 cursor-pointer"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {t("extend.predict.fundWallet.title")}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Positions panel
// ---------------------------------------------------------------------------

type SortKey = "value" | "pnl" | "size";

const SORT_OPTIONS = [
  { key: "value" as SortKey, labelKey: "extend.portfolio.sortValue" as const },
  { key: "pnl" as SortKey, labelKey: "extend.portfolio.sortPnl" as const },
  { key: "size" as SortKey, labelKey: "extend.portfolio.sortShares" as const },
];

function positionSortValue(p: PredictPosition, key: SortKey): number {
  switch (key) {
    case "value":
      return p.current_value ?? p.size * (p.current_price ?? 0);
    case "pnl":
      return p.pnl ?? 0;
    case "size":
      return p.size ?? 0;
  }
}

function PositionsPanel({
  positions,
  isLoading,
}: {
  positions: PredictPosition[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    let list = positions;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.market?.question?.toLowerCase().includes(q) ||
          p.market?.outcomes?.[0]?.label?.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => positionSortValue(b, sortKey) - positionSortValue(a, sortKey));
  }, [positions, search, sortKey]);

  const currentLabel = t(SORT_OPTIONS.find((o) => o.key === sortKey)!.labelKey);

  if (isLoading) return <PanelSkeleton />;

  return (
    <div className="space-y-4">
      {/* Search + sort row */}
      <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder={t("extend.portfolio.searchPositions")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-800/50 bg-zinc-900/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 transition-colors focus:border-zinc-700 focus:outline-none"
          />
        </div>
        <div ref={sortRef} className="relative sm:w-auto">
          <button
            type="button"
            onClick={() => setSortMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800/50 bg-zinc-900/50 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-all hover:bg-zinc-800/50 hover:text-zinc-300 cursor-pointer"
          >
            <span>{currentLabel}</span>
            <ChevronDownIcon className={cn("h-3.5 w-3.5 transition-transform", sortMenuOpen && "rotate-180")} />
          </button>
          {sortMenuOpen && (
            <div
              className="absolute right-0 z-50 mt-2 w-36 overflow-hidden rounded-xl border border-zinc-800 shadow-2xl shadow-black/50"
              style={{ backgroundColor: "#18181b" }}
            >
              <div className="p-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { setSortKey(opt.key); setSortMenuOpen(false); }}
                    className={cn(
                      "flex w-full items-center px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer",
                      sortKey === opt.key
                        ? "bg-violet-500/10 text-violet-300"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/50",
                    )}
                  >
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Position rows */}
      {filtered.length === 0 ? (
        <EmptyState message={t("extend.portfolio.noPositions")} />
      ) : (
        <div className="divide-y divide-zinc-800/30 overflow-hidden rounded-xl border border-zinc-800/30 bg-zinc-900/20">
          {filtered.map((pos, i) => (
            <PositionRow key={`${pos.source}-${pos.market?.slug ?? i}`} position={pos} />
          ))}
        </div>
      )}
    </div>
  );
}

function PositionRow({ position }: { position: PredictPosition }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { onOpen: openTradeModal } = useAsyncModal<PredictTradeModalParams>(PREDICT_TRADE_MODAL_ID);
  const pnl = position.pnl ?? 0;
  const pnlPercent = position.pnl_percent ?? 0;
  const avgPrice = position.avg_price ?? 0;
  const currentPrice = position.current_price ?? 0;
  const invested = position.size * avgPrice;
  const currentValue = position.current_value ?? position.size * currentPrice;
  const pnlColor = pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-red-400" : "text-zinc-400";
  const marketLabel = position.market?.question ?? "—";
  const marketName =
    position.market?.outcomes?.[0]?.label ?? position.market?.slug ?? "";
  const sideLabel = position.side;
  const isYes = sideLabel?.toLowerCase() === "yes";
  const source = position.source;

  const imageUrl = position.market?.image_url || position.event?.image_url;
  const eventSlug = position.event?.slug;
  const handleNavigate = useCallback(() => {
    if (eventSlug) router.push(predictEventHref({ slug: eventSlug, source }));
  }, [eventSlug, source, router]);

  const handleSell = useCallback(
    () => {
      if (!position.event || !position.market) return;
      openTradeModal({
        params: {
          event: position.event,
          market: position.market,
          initialSide: "sell",
          initialOutcome: (position.side?.toLowerCase() === "yes" ? "yes" : "no") as "yes" | "no",
        },
      });
    },
    [position.event, position.market, position.side, openTradeModal],
  );

  return (
    <div className="group transition-[background-color] duration-150 hover:bg-zinc-800/30">
      {/* Desktop row */}
      <div className="hidden items-center gap-4 px-5 py-4 lg:flex">
        {/* Col 1: Icon + event info */}
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
              className={cn("mb-1 line-clamp-1 text-sm font-medium text-white", eventSlug && "cursor-pointer hover:underline")}
              onClick={handleNavigate}
            >
              {marketLabel}
            </span>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="max-w-[200px] truncate">{marketName}</span>
              <span className="text-zinc-700">&bull;</span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-medium",
                  isYes
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400",
                )}
              >
                {sideLabel}
              </span>
              <span className="text-zinc-600">&bull;</span>
              <span>{position.size} shares</span>
              <span className="text-zinc-600">&bull;</span>
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
            </div>
          </div>
        </div>

        {/* Col 2: Price change */}
        <div className="min-w-[120px] shrink-0 text-center">
          <span className="text-sm">
            {formatPrice(avgPrice)}{" "}
            <span className="text-zinc-600">&rarr;</span>{" "}
            <span className={currentPrice > avgPrice ? "text-emerald-400" : currentPrice < avgPrice ? "text-red-400" : ""}>
              {formatPrice(currentPrice)}
            </span>
          </span>
        </div>

        {/* Col 3: Invested */}
        <div className="min-w-[90px] shrink-0 text-right">
          <div className="mb-0.5 text-xs text-zinc-500">{t("extend.portfolio.invested")}</div>
          <div className="text-sm font-medium text-white">${invested.toFixed(2)}</div>
        </div>

        {/* Col 4: Value + PnL */}
        <div className="min-w-[130px] shrink-0 text-right">
          <div className="mb-0.5 text-base font-bold text-white">${currentValue.toFixed(2)}</div>
          <div className={cn("text-xs font-semibold", pnlColor)}>
            {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)} ({pnlPercent >= 0 ? "+" : ""}
            {pnlPercent.toFixed(1)}%)
          </div>
        </div>

        {/* Col 5: Sell button */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={handleSell}
            className="cursor-pointer rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/20"
          >
            {t("extend.portfolio.sell")}
          </button>
        </div>
      </div>

      {/* Mobile card */}
      <div className="p-4 lg:hidden">
        <div className="mb-3 flex gap-3">
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
              className={cn("line-clamp-2 text-sm font-medium text-white", eventSlug && "cursor-pointer hover:underline")}
              onClick={handleNavigate}
            >
              {marketLabel}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-medium",
                  isYes
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400",
                )}
              >
                {sideLabel}
              </span>
              <span>{position.size} shares</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs">
            <span className="text-zinc-500">{formatPrice(avgPrice)}</span>
            <span className="mx-1 text-zinc-600">&rarr;</span>
            <span className={currentPrice > avgPrice ? "text-emerald-400" : currentPrice < avgPrice ? "text-red-400" : "text-zinc-300"}>
              {formatPrice(currentPrice)}
            </span>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-white">${currentValue.toFixed(2)}</div>
            <div className={cn("text-xs font-semibold", pnlColor)}>
              {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)} ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
            </div>
          </div>
          <button
            type="button"
            onClick={handleSell}
            className="ml-3 cursor-pointer rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400"
          >
            {t("extend.portfolio.sell")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders panel
// ---------------------------------------------------------------------------

function OrdersPanel({ solanaAddr, evmAddr }: { solanaAddr: string; evmAddr: string }) {
  const { t } = useTranslation();
  const cancelMutation = useCancelOrder();
  const { credentials } = usePolymarket();

  const polymarketGetHeaders = useMemo(() => {
    if (!credentials) return undefined;
    return async (): Promise<Record<string, string>> => {
      const headers = await buildPolymarketL2Headers(credentials.address, {
        apiKey: credentials.apiKey,
        secret: credentials.secret,
        passphrase: credentials.passphrase,
        method: "GET",
        requestPath: "/orders",
      });
      return headers as unknown as Record<string, string>;
    };
  }, [credentials]);

  const {
    data: kalshiOrders,
    isLoading: kalshiLoading,
    fetchNextPage: fetchNextKalshi,
    hasNextPage: hasMoreKalshi,
    isFetchingNextPage: isFetchingKalshi,
  } = useInfiniteOrders({ source: "kalshi", wallet_address: solanaAddr });
  const {
    data: polyOrders,
    isLoading: polyLoading,
    fetchNextPage: fetchNextPoly,
    hasNextPage: hasMorePoly,
    isFetchingNextPage: isFetchingPoly,
  } = useInfiniteOrders(
    { source: "polymarket", wallet_address: credentials ? evmAddr : "" },
    { getHeaders: polymarketGetHeaders },
  );

  const isLoading = kalshiLoading || polyLoading;
  const isFetchingMore = isFetchingKalshi || isFetchingPoly;
  const hasMore = hasMoreKalshi || hasMorePoly;

  const orders = useMemo(() => {
    const all: PredictOrder[] = [];
    const openStatuses = new Set(["live", "open", "submitted", "pending"]);
    if (kalshiOrders?.pages) {
      all.push(
        ...kalshiOrders.pages.flatMap((p) => p.items).filter((o) => openStatuses.has(o.status)),
      );
    }
    if (polyOrders?.pages) {
      all.push(
        ...polyOrders.pages.flatMap((p) => p.items).filter((o) => openStatuses.has(o.status)),
      );
    }
    return all;
  }, [kalshiOrders, polyOrders]);

  const handleCancel = useCallback(
    (order: PredictOrder) => {
      cancelMutation.mutate({ source: order.source, id: order.id });
    },
    [cancelMutation],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    const last = items[items.length - 1];
    if (!last) return;
    if (last.index >= orders.length - 5 && hasMore && !isFetchingMore) {
      if (hasMoreKalshi) fetchNextKalshi();
      if (hasMorePoly) fetchNextPoly();
    }
  }, [
    virtualizer.getVirtualItems(),
    orders.length,
    hasMore,
    hasMoreKalshi,
    hasMorePoly,
    isFetchingMore,
    fetchNextKalshi,
    fetchNextPoly,
  ]);

  if (isLoading) return <PanelSkeleton />;
  if (orders.length === 0) return <EmptyState message={t("extend.portfolio.noOrders")} />;

  return (
    <div
      ref={parentRef}
      className="mt-4 max-h-[600px] overflow-auto rounded-xl border border-zinc-800/30 bg-zinc-900/20"
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const order = orders[vItem.index];
          return (
            <div
              key={order.id}
              className="absolute left-0 top-0 w-full"
              style={{ height: vItem.size, transform: `translateY(${vItem.start}px)` }}
            >
              <OrderRow
                order={order}
                onCancel={handleCancel}
                isCancelling={cancelMutation.isPending}
                isLast={vItem.index === orders.length - 1}
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

function OrderRow({
  order,
  onCancel,
  isCancelling,
  isLast,
}: {
  order: PredictOrder;
  onCancel: (order: PredictOrder) => void;
  isCancelling: boolean;
  isLast: boolean;
}) {
  const { t } = useTranslation();
  const isBuy = order.side === "BUY";
  const source = order.source;

  return (
    <div
      className={cn(
        "group h-full transition-[background-color] duration-150 hover:bg-zinc-800/30",
        !isLast && "border-b border-zinc-800/30",
      )}
    >
      {/* Desktop */}
      <div className="hidden h-full items-center gap-4 px-5 py-4 lg:flex">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800/50 bg-zinc-900">
          {source === "kalshi" ? (
            <KalshiIcon width={28} height={10} />
          ) : (
            <PolymarketIcon width={20} height={20} />
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
            isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400",
          )}
        >
          {order.side}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm capitalize text-white">
          {order.outcome ?? "—"}
        </span>
        <span className="shrink-0 text-xs capitalize text-zinc-500">{order.order_type ?? "limit"}</span>
        <span className="shrink-0 text-sm font-mono text-white">
          {order.price ? formatPrice(parseFloat(order.price)) : "—"}
        </span>
        <span className="shrink-0 text-xs text-zinc-400">
          {order.size_matched ?? "0"}/{order.original_size ?? "—"}
        </span>
        <OrderStatusBadge status={order.status} />
        <button
          type="button"
          onClick={() => onCancel(order)}
          disabled={isCancelling}
          className="shrink-0 cursor-pointer rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
        >
          {t("extend.portfolio.cancel")}
        </button>
      </div>

      {/* Mobile */}
      <div className="p-4 lg:hidden">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800/50 bg-zinc-900">
            {source === "kalshi" ? (
              <KalshiIcon width={24} height={9} />
            ) : (
              <PolymarketIcon width={18} height={18} />
            )}
          </div>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
              isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400",
            )}
          >
            {order.side}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm capitalize text-white">
            {order.outcome ?? "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="capitalize">{order.order_type ?? "limit"}</span>
            <span className="font-mono text-white">
              {order.price ? formatPrice(parseFloat(order.price)) : "—"}
            </span>
            <span>{order.size_matched ?? "0"}/{order.original_size ?? "—"}</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <button
            type="button"
            onClick={() => onCancel(order)}
            disabled={isCancelling}
            className="cursor-pointer rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400"
          >
            {t("extend.portfolio.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const colorMap: Record<string, string> = {
    live: "bg-emerald-500/10 text-emerald-400",
    open: "bg-emerald-500/10 text-emerald-400",
    submitted: "bg-amber-500/10 text-amber-400",
    pending: "bg-amber-500/10 text-amber-400",
    matched: "bg-sky-500/10 text-sky-400",
    cancelled: "bg-zinc-500/10 text-zinc-400",
    failed: "bg-red-500/10 text-red-400",
    expired: "bg-zinc-500/10 text-zinc-400",
  };

  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
        colorMap[status] ?? "bg-zinc-500/10 text-zinc-400",
      )}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Trades (history) panel
// ---------------------------------------------------------------------------

function TradesPanel({ solanaAddr, evmAddr }: { solanaAddr: string; evmAddr: string }) {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    data: kalshiTrades,
    isLoading: kalshiLoading,
    fetchNextPage: fetchNextKalshi,
    hasNextPage: hasMoreKalshi,
    isFetchingNextPage: isFetchingKalshi,
  } = useInfiniteTrades({ source: "kalshi", wallet: solanaAddr, limit: 50 });
  const {
    data: polyTrades,
    isLoading: polyLoading,
    fetchNextPage: fetchNextPoly,
    hasNextPage: hasMorePoly,
    isFetchingNextPage: isFetchingPoly,
  } = useInfiniteTrades({ source: "polymarket", wallet: evmAddr, limit: 50 });

  const isLoading = kalshiLoading || polyLoading;
  const isFetchingMore = isFetchingKalshi || isFetchingPoly;
  const hasMore = hasMoreKalshi || hasMorePoly;

  const trades = useMemo(() => {
    const all: PredictTrade[] = [];
    if (kalshiTrades?.pages) all.push(...kalshiTrades.pages.flatMap((p) => p.items));
    if (polyTrades?.pages) all.push(...polyTrades.pages.flatMap((p) => p.items));
    all.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    return all;
  }, [kalshiTrades, polyTrades]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: trades.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    const last = items[items.length - 1];
    if (!last) return;
    if (last.index >= trades.length - 5 && hasMore && !isFetchingMore) {
      if (hasMoreKalshi) fetchNextKalshi();
      if (hasMorePoly) fetchNextPoly();
    }
  }, [
    virtualizer.getVirtualItems(),
    trades.length,
    hasMore,
    hasMoreKalshi,
    hasMorePoly,
    isFetchingMore,
    fetchNextKalshi,
    fetchNextPoly,
  ]);

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
      className="mt-4 max-h-[600px] overflow-auto rounded-xl border border-zinc-800/30 bg-zinc-900/20"
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const trade = trades[vItem.index];
          return (
            <div
              key={trade.id ?? vItem.index}
              className="absolute left-0 top-0 w-full"
              style={{ height: vItem.size, transform: `translateY(${vItem.start}px)` }}
            >
              <TradeRow
                trade={trade}
                isLast={vItem.index === trades.length - 1}
                onNavigate={handleNavigate}
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
}: {
  trade: PredictTrade;
  isLast: boolean;
  onNavigate: (trade: PredictTrade) => void;
}) {
  const isBuy = trade.side?.toUpperCase() === "BUY";
  const timeStr = formatTimestamp(trade.timestamp);
  const price = trade.price ?? 0;
  const usdSize = trade.usd_size ?? 0;
  const source = trade.source;
  const eventTitle = trade.event?.title ?? trade.market?.question ?? "";
  const outcomeLabel = trade.outcome ?? "—";
  const tradeImageUrl = trade.event?.image_url;

  return (
    <div
      className={cn(
        "group h-full transition-[background-color] duration-150 hover:bg-zinc-800/30",
        !isLast && "border-b border-zinc-800/30",
      )}
    >
      {/* Desktop row */}
      <div className="hidden h-full items-center gap-4 px-5 py-4 lg:flex">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800/50 bg-zinc-900">
          {tradeImageUrl ? (
            <img src={tradeImageUrl} alt="" className="h-full w-full object-cover" />
          ) : source === "kalshi" ? (
            <KalshiIcon width={32} height={12} />
          ) : (
            <PolymarketIcon width={24} height={24} />
          )}
        </div>

        {/* Event + outcome info */}
        <div className="min-w-0 flex-1">
          {eventTitle && (
            <span
              className={cn(
                "mb-1 line-clamp-1 text-sm font-medium text-white",
                trade.event?.slug && "cursor-pointer hover:underline",
              )}
              onClick={() => onNavigate(trade)}
            >
              {eventTitle}
            </span>
          )}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="max-w-[200px] truncate capitalize">{outcomeLabel}</span>
            <span className="text-zinc-700">&bull;</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-medium",
                isBuy
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400",
              )}
            >
              {trade.side}
            </span>
            <span className="text-zinc-600">&bull;</span>
            <span>{trade.size} shares</span>
            <span className="text-zinc-600">&bull;</span>
            <span className="inline-flex items-center gap-1">
              {source === "kalshi" ? (
                <KalshiIcon width={36} height={12} />
              ) : (
                <>
                  <PolymarketIcon width={14} height={14} />
                  <span className="text-zinc-400">Polymarket</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Price */}
        <div className="min-w-[80px] shrink-0 text-center">
          <div className="text-sm font-medium text-white">{formatPrice(price)}</div>
        </div>

        {/* Total */}
        <div className="min-w-[90px] shrink-0 text-right">
          <div className="text-sm font-bold text-white">${usdSize.toFixed(2)}</div>
        </div>

        {/* Time */}
        <div className="min-w-[80px] shrink-0 text-right">
          <span className="whitespace-nowrap text-xs text-zinc-500">{timeStr}</span>
        </div>
      </div>

      {/* Mobile card */}
      <div className="p-4 lg:hidden">
        <div className="mb-3 flex gap-3">
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
            {eventTitle && (
              <span
                className={cn(
                  "line-clamp-2 text-sm font-medium text-white",
                  trade.event?.slug && "cursor-pointer hover:underline",
                )}
                onClick={() => onNavigate(trade)}
              >
                {eventTitle}
              </span>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-medium",
                  isBuy
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400",
                )}
              >
                {trade.side}
              </span>
              <span className="capitalize">{outcomeLabel}</span>
              <span className="text-zinc-600">&bull;</span>
              <span>{trade.size} shares</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">{timeStr}</span>
          <div className="text-right">
            <div className="text-sm font-bold text-white">${usdSize.toFixed(2)}</div>
            <div className="text-xs text-zinc-400">{formatPrice(price)}/share</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers & icons
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-zinc-500">{message}</div>
  );
}

function PanelSkeleton() {
  return (
    <div className="mt-4 flex animate-pulse flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl bg-zinc-800/40" />
      ))}
    </div>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
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
      <path d="M16 7h6v6" />
      <path d="m22 7-8.5 8.5-5-5L2 17" />
    </svg>
  );
}

function TrendingDownIcon({ className }: { className?: string }) {
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
      <path d="M16 17h6v-6" />
      <path d="m22 17-8.5-8.5-5 5L2 7" />
    </svg>
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

function ChevronDownIcon({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
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
