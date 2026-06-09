"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@liberfi.io/i18n";
import { Chain } from "@liberfi.io/types";
import {
  useAuth,
  useConnectedWallet,
} from "@liberfi.io/wallet-connector";
import {
  PredictTradeModal,
  PredictSellModal,
  PredictRedeemModal,
} from "@liberfi.io/ui-predict";
import { usePositionsMulti } from "@liberfi.io/react-predict";
import { cn } from "@liberfi.io/ui";
import { useWalletPnl } from "../../features/leaderboard/data/queries";
import {
  PerformanceBiasCard,
  TotalValueCard,
  YieldRiskCard,
} from "../../features/leaderboard/components/SummaryCards";
import {
  PerformanceBiasCardSkeleton,
  TotalValueCardSkeleton,
  YieldRiskCardSkeleton,
} from "../../features/leaderboard/components/skeletons";
import {
  PositionsPanel,
  OrdersPanel,
  TradesPanel,
  Shimmer,
} from "./portfolio-activity";

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

      {/* Summary panels — same 3-col grid as PortfolioContent */}
      <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TotalValueCardSkeleton />
        <PerformanceBiasCardSkeleton />
        <YieldRiskCardSkeleton />
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

      {/* Summary panels — total value / performance & bias / yield & risk */}
      <PortfolioSummary wallet={evmAddr} />

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
// Summary panels (total value / performance & bias / yield & risk)
// ---------------------------------------------------------------------------

const SUMMARY_GRID = "mb-10 grid shrink-0 grid-cols-1 gap-6 lg:grid-cols-3";

function PortfolioSummary({ wallet }: { wallet: string }) {
  const { t } = useTranslation();
  // Panels are driven by the connected Polymarket (EVM) wallet via the
  // ChainStream smart-money PNL endpoint; Kalshi is not represented here.
  const { data, isError } = useWalletPnl(wallet || undefined);

  // Until the connected EVM wallet resolves (or the query is in flight) show the
  // card skeletons so the layout does not shift.
  if (!wallet || !data) {
    if (isError) {
      return (
        <div className={SUMMARY_GRID}>
          <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500 lg:col-span-3">
            {t("extend.leaderboard.loadError")}
          </div>
        </div>
      );
    }
    return (
      <div className={SUMMARY_GRID}>
        <TotalValueCardSkeleton />
        <PerformanceBiasCardSkeleton />
        <YieldRiskCardSkeleton />
      </div>
    );
  }

  return (
    <div className={SUMMARY_GRID}>
      <TotalValueCard summary={data.summary} />
      <PerformanceBiasCard summary={data.summary} />
      <YieldRiskCard summary={data.summary} wallet={wallet} tag={data.tag} />
    </div>
  );
}
