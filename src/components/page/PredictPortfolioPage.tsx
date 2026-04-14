"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { Chain } from "@liberfi.io/types";
import {
  useAuth,
  useConnectedWallet,
  useWallets,
  type EvmWalletAdapter,
} from "@liberfi.io/wallet-connector";
import {
  usePredictWallet,
  PredictTradeModal,
  PredictSellModal,
  PREDICT_SELL_MODAL_ID,
  type PredictSellModalParams,
  PredictRedeemModal,
  PREDICT_REDEEM_MODAL_ID,
  type PredictRedeemModalParams,
} from "@liberfi.io/ui-predict";
import {
  usePositionsMulti,
  useOrdersMulti,
  useInfiniteTradesMulti,
  useCancelOrder,
  usePolymarket,
  buildPolymarketL2Headers,
  type PolymarketSigner,
  type PredictPosition,
  type PredictOrder,
  type PredictTrade,
} from "@liberfi.io/react-predict";
import {
  cn,
  toast,
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
    <div className="bg-zinc-950/50 sm:h-[calc(100vh-var(--header-height))] sm:min-h-0 sm:overflow-hidden">
      <div className="mx-auto h-full max-w-[1200px] px-4 pt-6 sm:flex sm:flex-col sm:px-6 sm:pt-8 lg:px-8">
        {authStatus === "authenticated" ? <PortfolioContent /> : <PortfolioSkeleton />}
      </div>
      <PredictTradeModal />
      <PredictSellModal />
      <PredictRedeemModal />
    </div>
  );
}

function PortfolioSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <style>{`@keyframes pf-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* Title */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t("extend.portfolio.title")}
        </h1>
      </div>

      {/* Hero cards — same 3-col grid as PortfolioContent */}
      <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {/* Net Worth card (spans 2 cols) */}
        <div
          className="relative overflow-hidden sm:col-span-2"
          style={{
            borderRadius: 24,
            border: "1px solid rgba(39,39,42,0.6)",
            background: "rgba(24,24,27,0.4)",
            padding: "24px 32px",
          }}
        >
          <Shimmer delay={0} style={{ height: 14, width: 120, marginBottom: 12 }} />
          <Shimmer delay={100} style={{ height: 48, width: 200, marginBottom: 12 }} />
          <Shimmer delay={200} style={{ height: 28, width: 140, borderRadius: 8 }} />
        </div>
        {/* Right column: 2 small cards */}
        <div className="flex flex-col gap-4">
          {[0, 1].map((j) => (
            <div
              key={j}
              style={{
                flex: 1,
                borderRadius: 16,
                border: "1px solid rgba(39,39,42,0.5)",
                background: "rgba(24,24,27,0.4)",
                padding: 20,
              }}
            >
              <Shimmer delay={j * 150 + 100} style={{ height: 12, width: 100, marginBottom: 12 }} />
              <Shimmer delay={j * 150 + 200} style={{ height: 32, width: 96 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Tabs — matches actual tab bar */}
      <div style={{ borderBottom: "1px solid rgba(39,39,42,0.5)" }}>
        <div className="flex gap-0">
          {[72, 88, 96].map((w, i) => (
            <div key={i} style={{ padding: "10px 16px" }}>
              <Shimmer delay={i * 100 + 300} style={{ height: 14, width: w }} />
            </div>
          ))}
        </div>
      </div>

      {/* Position rows shimmer */}
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
            {/* Desktop row shimmer */}
            <div className="hidden lg:flex items-center gap-3" style={{ padding: "16px 20px" }}>
              <Shimmer delay={i * 120 + 400} style={{ height: 44, width: 44, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Shimmer delay={i * 120 + 450} style={{ height: 14, width: i % 2 === 0 ? "70%" : "55%", marginBottom: 8 }} />
                <Shimmer delay={i * 120 + 500} style={{ height: 10, width: i % 2 === 0 ? "45%" : "35%" }} />
              </div>
              <Shimmer delay={i * 120 + 480} style={{ height: 14, width: 80, flexShrink: 0 }} />
              <Shimmer delay={i * 120 + 520} style={{ height: 20, width: 72, flexShrink: 0 }} />
              <Shimmer delay={i * 120 + 560} style={{ height: 36, width: 64, borderRadius: 8, flexShrink: 0 }} />
            </div>
            {/* Compact row shimmer (tablet + mobile) */}
            <div className="lg:hidden" style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <Shimmer delay={i * 120 + 400} style={{ height: 40, width: 40, borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Shimmer delay={i * 120 + 450} style={{ height: 14, width: i % 2 === 0 ? "80%" : "65%", marginBottom: 6 }} />
                  <Shimmer delay={i * 120 + 500} style={{ height: 10, width: "40%" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Shimmer delay={i * 120 + 480} style={{ height: 12, width: 100 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Shimmer delay={i * 120 + 520} style={{ height: 14, width: 60 }} />
                  <Shimmer delay={i * 120 + 560} style={{ height: 28, width: 52, borderRadius: 8 }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Shimmer({ delay = 0, style }: { delay?: number; style: React.CSSProperties }) {
  return (
    <div
      style={{
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)",
        backgroundSize: "200% 100%",
        animation: `pf-shimmer 1.8s ease-in-out infinite ${delay}ms`,
        borderRadius: 6,
        ...style,
      }}
    />
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

  const buyingPowerCents = toCents(kalshiUsdcBalance ?? 0) + toCents(polymarketUsdcBalance ?? 0);
  const investedCents = useMemo(() => {
    let total = 0;
    for (const p of allPositions) {
      total += p.current_value ?? p.size * (p.current_price ?? 0);
    }
    return toCents(total);
  }, [allPositions]);
  const netWorthCents = buyingPowerCents + investedCents;

  const allTimePnl = useMemo(() => {
    let pnl = 0;
    for (const p of allPositions) {
      pnl += p.pnl ?? 0;
    }
    return pnl;
  }, [allPositions]);

  const heroLoading = balanceLoading || positionsLoading;

  if (heroLoading) return <PortfolioSkeleton />;

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
    <div className="sm:flex sm:min-h-0 sm:flex-1 sm:flex-col">
      {/* Title row */}
      <div className="mb-8 flex shrink-0 items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t("extend.portfolio.title")}
        </h1>
      </div>

      {/* Hero cards — 3-col grid */}
      <div className="mb-10 grid shrink-0 grid-cols-1 gap-6 sm:grid-cols-3">
        {/* Total Net Worth (spans 2 cols) */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 p-6 sm:col-span-2 sm:p-8" style={{ background: "linear-gradient(145deg, rgba(24,24,27,1) 0%, rgba(30,30,34,0.95) 40%, rgba(24,24,27,0.88) 70%, rgba(20,20,22,1) 100%)" }}>
          <div className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(199,255,46,0.10) 0%, rgba(199,255,46,0.03) 50%, transparent 70%)" }} />
          <div className="pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(199,255,46,0.04) 0%, transparent 60%)" }} />
          <div className="pointer-events-none absolute left-1/3 top-1/2 h-40 w-64 -translate-y-1/2 rounded-full blur-3xl" style={{ background: "radial-gradient(ellipse, rgba(255,255,255,0.015) 0%, transparent 70%)" }} />
          <div className="relative z-10">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-zinc-400">
                  <span className="text-sm font-medium">{t("extend.portfolio.totalNetWorth")}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                    ${formatCents(netWorthCents)}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium",
                      allTimePnl >= 0
                        ? "bg-bullish/10 text-bullish"
                        : "bg-bearish/10 text-bearish",
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
              <div className="hidden sm:flex gap-2 sm:gap-3">
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
            <div className="text-2xl font-bold text-white">${formatCents(buyingPowerCents)}</div>
          </div>
          <div className="flex-1 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 p-5 transition-colors hover:bg-zinc-900/80">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-400">
                <ChartLineIcon width={16} height={16} className="text-bullish opacity-70" />
                <span className="text-sm font-medium">{t("extend.portfolio.investedAssets")}</span>
              </div>
              {positionsCount > 0 && (
                <span className="text-xs text-zinc-500">
                  {positionsCount} {positionsCount === 1 ? "position" : "positions"}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-white">${formatCents(investedCents)}</div>
          </div>
        </div>
      </div>

      {/* Tab + list section: fill remaining viewport on mobile, flex-fill on tablet+ */}
      <div className="flex h-[calc(100dvh-var(--scaffold-header-height)-var(--scaffold-footer-height))] flex-col sm:h-auto sm:min-h-0 sm:flex-1">
        {/* Tabs */}
        <div className="shrink-0 border-b border-zinc-800/50">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
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

        {/* Tab content */}
        <div className="flex min-h-0 flex-1 flex-col">
          {activeTab === "positions" && (
            <PositionsPanel positions={allPositions} isLoading={positionsLoading} />
          )}
          {activeTab === "orders" && <OrdersPanel solanaAddr={solanaAddr} evmAddr={evmAddr} />}
          {activeTab === "history" && <TradesPanel solanaAddr={solanaAddr} evmAddr={evmAddr} />}
        </div>
      </div>
    </div>
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
      className="flex items-center gap-2 rounded-xl border border-bullish/30 bg-bullish/10 px-4 py-2.5 text-sm font-semibold text-bullish transition-all hover:border-bullish/50 hover:bg-bullish/20 cursor-pointer"
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Search + sort row */}
      <div className="flex shrink-0 items-center gap-3 pt-4">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder={t("extend.portfolio.searchPositions")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 transition-all focus:outline-none"
            style={{
              borderRadius: 10,
              border: "1px solid rgba(63,63,70,0.5)",
              background: "rgba(39,39,42,0.6)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(63,63,70,1)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(63,63,70,0.5)"; }}
          />
        </div>
        <div ref={sortRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setSortMenuOpen((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 10,
              border: "1px solid rgba(63,63,70,0.5)",
              background: "rgba(39,39,42,0.6)",
              padding: "8px 12px",
              fontSize: 14,
              color: "#d4d4d8",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(39,39,42,1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(39,39,42,0.6)"; }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, color: "#a1a1aa" }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21 16-4 4-4-4" />
              <path d="M17 20V4" />
              <path d="m3 8 4-4 4 4" />
              <path d="M7 4v16" />
            </svg>
            <span>{currentLabel}</span>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, color: "#71717a", transition: "transform 0.15s", transform: sortMenuOpen ? "rotate(180deg)" : undefined }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {sortMenuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                zIndex: 50,
                marginTop: 8,
                borderRadius: 14,
                border: "1px solid rgba(39,39,42,1)",
                background: "rgba(24,24,27,1)",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                overflow: "hidden",
                width: 200,
                padding: 4,
              }}
            >
              {SORT_OPTIONS.map((opt) => {
                const isActive = sortKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "10px 12px",
                      textAlign: "left",
                      fontSize: 14,
                      fontWeight: 500,
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      background: isActive ? "rgba(199,255,46,0.08)" : "transparent",
                      color: isActive ? "#c7ff2e" : "#a1a1aa",
                      borderRadius: 10,
                    }}
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "rgba(39,39,42,0.5)"; e.currentTarget.style.color = "#fff"; } }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#a1a1aa"; } }}
                    onClick={() => { setSortKey(opt.key); setSortMenuOpen(false); }}
                  >
                    <span>{t(opt.labelKey)}</span>
                    {isActive && (
                      <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, color: "#c7ff2e", flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Position rows */}
      {filtered.length === 0 ? (
        <EmptyState message={t("extend.portfolio.noPositions")} icon="positions" />
      ) : (
        <div className="min-h-0 flex-1 divide-y divide-zinc-800/30 overflow-y-auto rounded-xl border border-zinc-800/30 bg-zinc-900/20 custom-scrollbar">
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
  const { onOpen: openSellModal } = useAsyncModal<PredictSellModalParams>(PREDICT_SELL_MODAL_ID);
  const { onOpen: openRedeemModal } = useAsyncModal<PredictRedeemModalParams>(PREDICT_REDEEM_MODAL_ID);
  const pnl = position.pnl ?? 0;
  const pnlPercent = position.pnl_percent ?? 0;
  const avgPrice = position.avg_price ?? 0;
  const currentPrice = position.current_price ?? 0;
  const invested = position.size * avgPrice;
  const currentValue = position.current_value ?? position.size * currentPrice;
  const pnlColor = pnl > 0 ? "text-bullish" : pnl < 0 ? "text-bearish" : "text-zinc-400";
  const marketLabel = position.market?.question ?? "—";
  const marketName =
    position.market?.outcomes?.[0]?.label ?? position.market?.slug ?? "";
  const sideLabel = position.side;
  const isYes = sideLabel?.toLowerCase() === "yes";
  const source = position.source;

  const imageUrl = position.market?.image_url || position.event?.image_url;
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
              onMouseEnter={handlePrefetch}
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
                    ? "bg-bullish/10 text-bullish"
                    : "bg-bearish/10 text-bearish",
                )}
              >
                {sideLabel}
              </span>
              <span className="text-zinc-600">&bull;</span>
              <span>
                {formatShares(position.size)}
                {t("predict.trade.sharesUnit")}
              </span>
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
            <span className={currentPrice > avgPrice ? "text-bullish" : currentPrice < avgPrice ? "text-bearish" : ""}>
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

        {/* Col 5: Sell / Redeem button */}
        <div className="shrink-0">
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
          <div className="flex items-center gap-2">
            <span
              className={cn("min-w-0 flex-1 truncate text-sm font-medium text-white", eventSlug && "cursor-pointer hover:underline")}
              onClick={handleNavigate}
              onMouseEnter={handlePrefetch}
            >
              {marketLabel}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-medium",
                isYes ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish",
              )}
            >
              {sideLabel}
            </span>
            <span>{formatShares(position.size)}{t("predict.trade.sharesUnit")}</span>
            <span className="text-zinc-600">&middot;</span>
            <span className="text-zinc-500">
              {formatPrice(avgPrice)}<span className="mx-0.5">&rarr;</span>
              <span className={currentPrice > avgPrice ? "text-bullish" : currentPrice < avgPrice ? "text-bearish" : ""}>
                {formatPrice(currentPrice)}
              </span>
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold text-white">${currentValue.toFixed(2)}</div>
          <div className={cn("text-xs font-semibold", pnlColor)}>
            {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)} ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
          </div>
        </div>
        {position.redeemable ? (
          <button
            type="button"
            onClick={handleRedeem}
            className="shrink-0 cursor-pointer rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500/60"
          >
            {t("predict.redeem.confirm")}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSell}
            className="shrink-0 cursor-pointer rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500/60"
          >
            {t("extend.portfolio.sell")}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders panel
// ---------------------------------------------------------------------------

function OrdersPanel({ solanaAddr, evmAddr }: { solanaAddr: string; evmAddr: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const wallets = useWallets();
  const evmWallet = useMemo(
    () => wallets.find((w) => w.chainNamespace === "EVM" && w.isConnected) as EvmWalletAdapter | undefined,
    [wallets],
  );
  const { polymarketSafeAddress } = usePredictWallet();
  const { credentials, authenticate } = usePolymarket();

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
      onSuccess: () => {
        toast.success(t("extend.portfolio.cancelSuccess"));
      },
      onError: () => {
        toast.error(t("extend.portfolio.cancelFailed"));
      },
    },
  );

  const credentialsReady = !!polymarketGetHeaders;
  const { data, isLoading: queryLoading } = useOrdersMulti(
    {
      kalshi_user: solanaAddr || undefined,
      polymarket_user: evmAddr || undefined,
    },
    { getHeaders: polymarketGetHeaders },
    { enabled: credentialsReady },
  );
  const isLoading = queryLoading || !credentialsReady;

  const orders = useMemo(() => {
    const all = data?.orders ?? [];
    const openStatuses = new Set<string>(["live", "open", "submitted", "pending"]);
    return all.filter((o: PredictOrder) => openStatuses.has(o.status));
  }, [data]);

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
      className="mt-4 min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-800/30 bg-zinc-900/20 custom-scrollbar"
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
}: {
  order: PredictOrder;
  onCancel: (order: PredictOrder) => void;
  onNavigate: (order: PredictOrder) => void;
  onPrefetch: (order: PredictOrder) => void;
  isCancelling: boolean;
  isLast: boolean;
}) {
  const { t } = useTranslation();
  const isBuy = order.side === "BUY";
  const source = order.source;
  const imageUrl = order.market?.image_url || order.event?.image_url;
  const marketQuestion = order.market?.question ?? "";
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
          {marketQuestion ? (
            <span
              className={cn(
                "mb-1 line-clamp-1 text-sm font-medium text-white",
                order.event?.slug && "cursor-pointer hover:underline",
              )}
              onClick={() => onNavigate(order)}
              onMouseEnter={() => onPrefetch(order)}
            >
              {marketQuestion}
            </span>
          ) : (
            <span className="mb-1 line-clamp-1 text-sm text-zinc-400">
              {order.outcome ?? "—"}
            </span>
          )}
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
          {marketQuestion ? (
            <span
              className={cn(
                "truncate text-sm font-medium text-white block",
                order.event?.slug && "cursor-pointer hover:underline",
              )}
              onClick={() => onNavigate(order)}
              onMouseEnter={() => onPrefetch(order)}
            >
              {marketQuestion}
            </span>
          ) : (
            <span className="truncate text-sm capitalize text-zinc-400 block">
              {order.outcome ?? "—"}
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

function TradesPanel({ solanaAddr, evmAddr }: { solanaAddr: string; evmAddr: string }) {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    data: tradesData,
    isLoading,
    fetchNextPage,
    hasNextPage: hasMore,
    isFetchingNextPage: isFetchingMore,
  } = useInfiniteTradesMulti({
    kalshi_user: solanaAddr || undefined,
    polymarket_user: evmAddr || undefined,
    limit: 50,
  });

  const trades = useMemo(
    () => tradesData?.pages.flatMap((p) => p.items) ?? [],
    [tradesData],
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
      className="mt-4 min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-800/30 bg-zinc-900/20 custom-scrollbar"
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
}: {
  trade: PredictTrade;
  isLast: boolean;
  onNavigate: (trade: PredictTrade) => void;
  onPrefetch: (trade: PredictTrade) => void;
}) {
  const { t } = useTranslation();
  const isRedeem = trade.type === "REDEEM";
  const isBuy = trade.side?.toUpperCase() === "BUY";
  const timeStr = formatTimestamp(trade.timestamp);
  const price = trade.price ?? 0;
  const usdSize = trade.usd_size ?? 0;
  const source = trade.source;
  const marketQuestion = trade.market?.question ?? "";
  const eventTitle = source === "kalshi" ? marketQuestion : (trade.event?.title ?? "");
  const outcomeLabel = trade.outcome ?? "—";
  const tradeImageUrl = trade.event?.image_url;

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

function EmptyState({ message, icon = "default" }: { message: string; icon?: "positions" | "orders" | "trades" | "default" }) {
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

function PanelSkeleton() {
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


function toCents(amount: number): number {
  return Math.floor(amount * 100);
}

function formatUsdc(amount: number): string {
  return formatCents(toCents(amount));
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
