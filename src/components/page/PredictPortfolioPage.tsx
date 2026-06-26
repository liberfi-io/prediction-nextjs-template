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
  usePredictWallet,
} from "@liberfi.io/ui-predict";
import { usePositionsMulti } from "@liberfi.io/react-predict";
import { ENABLE_KALSHI } from "../../libs/featureFlags";
import { cn } from "@liberfi.io/ui";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import { FUND_WALLET_MODAL_ID, type FundWalletParams } from "../FundWalletModal";
import { usePortfolioPnl } from "../../features/leaderboard/data/queries";
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
} from "./portfolio-activity";
import { PortfolioSkeleton } from "./portfolio-skeleton";

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
      <div className="mx-auto h-full max-w-[1200px] px-2 pt-2 sm:px-6 sm:pt-4 lg:px-8">
        {authStatus === "authenticated" ? <PortfolioContent /> : <PortfolioSkeleton />}
      </div>
      <PredictTradeModal />
      <PredictSellModal />
      <PredictRedeemModal />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content (authenticated)
// ---------------------------------------------------------------------------

function PortfolioContent() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PortfolioTab>("positions");
  const [positionSearch, setPositionSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const solanaWallet = useConnectedWallet(Chain.SOLANA);
  const evmWallet = useConnectedWallet(Chain.POLYGON);
  const solanaAddr = solanaWallet?.address ?? "";
  const evmAddr = evmWallet?.address ?? "";

  // Open the shared FundWalletModal (mounted once in AppLayout). Default to the
  // Polymarket (EVM) venue when connected — the portfolio is Polymarket-centric
  // — otherwise fall back to the Kalshi (Solana) wallet.
  const { onOpen: openFundWallet } =
    useAsyncModal<FundWalletParams>(FUND_WALLET_MODAL_ID);
  const fundWallet = (initialScreen: "deposit" | "withdraw") => {
    void openFundWallet({
      params: { initialScreen, initialWallet: evmAddr ? "evm" : "solana" },
    });
  };

  // The user-facing portfolio summary uses the connected EOA as input and lets
  // prediction-server resolve the active Polymarket wallet for ChainStream.
  // Keep the setup wallet in the audit log only; the tradeable positions list
  // below already uses the EOA and server-side active-wallet resolution.
  const {
    evmAddress: predictEvmAddress,
    polymarketWalletAddress,
    polymarketWalletKind,
  } = usePredictWallet();
  const portfolioPnlUser = predictEvmAddress ?? evmAddr;

  const { data: positionsData, isLoading: positionsLoading } = usePositionsMulti({
    kalshi_user: ENABLE_KALSHI ? solanaAddr || undefined : undefined,
    polymarket_user: evmAddr || undefined,
  });

  // Address audit: the PNL summary cards query ChainStream with the resolved
  // on-chain Polymarket wallet (deposit wallet / legacy Safe), while the
  // positions list queries with the connected EOA. Logged together so the two
  // can be compared against the upstream `chainstream upstream request` URL in
  // the server logs.
  useEffect(() => {
    console.info(
      "[portfolio-pnl-addr]",
      JSON.stringify({
        eoaEvm: evmAddr || null,
        eoaSolana: solanaAddr || null,
        polymarketWalletKind: polymarketWalletKind ?? null,
        setupWallet: polymarketWalletAddress ?? null,
        pnlPortfolioUser: portfolioPnlUser || null,
        positionsPolymarketUser: evmAddr || null,
      }),
    );
  }, [
    evmAddr,
    solanaAddr,
    polymarketWalletKind,
    polymarketWalletAddress,
    portfolioPnlUser,
  ]);

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
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
        <div className="flex flex-col gap-4 pb-4">
          <div className="flex shrink-0 items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {t("extend.portfolio.title")}
            </h1>
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => fundWallet("deposit")}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-bullish/25 bg-bullish/10 px-3.5 py-2 text-sm font-semibold text-bullish transition-colors hover:border-bullish/40 hover:bg-bullish/20"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {t("extend.predict.fundWallet.deposit")}
              </button>
              <button
                type="button"
                onClick={() => fundWallet("withdraw")}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/50 px-3.5 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {t("extend.predict.fundWallet.withdraw")}
              </button>
            </div>
          </div>

          <PortfolioSummary user={portfolioPnlUser} />

          <section className="flex flex-col">
            <div className="sticky top-0 z-10 -mx-px bg-[#0a0a0b]/95 pb-2 pt-1 backdrop-blur">
              <div className="flex flex-col gap-2 border-b border-zinc-800/50 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex gap-0 overflow-x-auto no-scrollbar">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "cursor-pointer whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-all",
                        activeTab === tab.key
                          ? "border-bullish text-bullish"
                          : "border-transparent text-zinc-400 hover:text-zinc-300",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {activeTab === "positions" && (
                  <div className="max-sm:px-2">
                    <div className="relative min-w-0 flex-1 sm:w-[220px] sm:flex-none">
                      <svg
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                      </svg>
                      <input
                        value={positionSearch}
                        onChange={(e) => setPositionSearch(e.target.value)}
                        placeholder={t("extend.portfolio.searchPositions")}
                        className="mb-1.5 w-full rounded-lg border border-zinc-800/60 bg-zinc-900/40 py-1.5 pl-9 pr-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-700 sm:mb-0"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3">
              {activeTab === "positions" && (
                <PositionsPanel
                  positions={allPositions}
                  isLoading={positionsLoading}
                  search={positionSearch}
                  fill={false}
                />
              )}
              {activeTab === "orders" && <OrdersPanel solanaAddr={solanaAddr} evmAddr={evmAddr} fill={false} />}
              {activeTab === "history" && <TradesPanel solanaAddr={solanaAddr} evmAddr={evmAddr} fill={false} />}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary panels (total value / performance & bias / yield & risk)
// ---------------------------------------------------------------------------

const SUMMARY_GRID = "grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-3";

function PortfolioSummary({ user }: { user: string }) {
  const { t } = useTranslation();
  // Panels are driven by portfolio-specific ChainStream proxy endpoints. The
  // backend resolves the connected EOA to the active Polymarket wallet, and the
  // card subqueries use the same portfolio namespace.
  const { data, isError } = usePortfolioPnl(user || undefined);
  const wallet = data?.wallet ?? "";

  // Until the connected EVM wallet resolves (or the query is in flight) show the
  // card skeletons so the layout does not shift.
  if (!user || !wallet || !data) {
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
      <TotalValueCard summary={data.summary} wallet={wallet} user={user} mode="portfolio" />
      <PerformanceBiasCard summary={data.summary} />
      <YieldRiskCard summary={data.summary} wallet={wallet} user={user} mode="portfolio" tag={data.tag} />
    </div>
  );
}
