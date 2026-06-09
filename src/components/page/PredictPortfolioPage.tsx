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
import { cn } from "@liberfi.io/ui";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import { FUND_WALLET_MODAL_ID, type FundWalletParams } from "../FundWalletModal";
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
      <div className="mx-auto h-full max-w-[1200px] px-2 pt-3 sm:flex sm:flex-col sm:px-6 sm:pt-8 lg:px-8">
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

  // Smart-money PNL is indexed by the on-chain Polymarket wallet (the deposit
  // wallet, or the legacy Gnosis Safe), never the connected EOA. Resolve it via
  // the Polymarket setup status so the summary cards query the same wallet that
  // actually holds the user's positions; passing the raw EOA returns no PNL.
  const { polymarketWalletAddress } = usePredictWallet();

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
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t("extend.portfolio.title")}
        </h1>
        {/* Deposit / withdraw — desktop only */}
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

      {/* Summary panels — total value / performance & bias / yield & risk */}
      <PortfolioSummary wallet={polymarketWalletAddress ?? ""} />

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

const SUMMARY_GRID = "mb-4 grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-3";

function PortfolioSummary({ wallet }: { wallet: string }) {
  const { t } = useTranslation();
  // Panels are driven by the resolved on-chain Polymarket wallet (deposit wallet
  // or legacy Safe, not the EOA) via the ChainStream smart-money PNL endpoint;
  // Kalshi is not represented here.
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
      <TotalValueCard summary={data.summary} wallet={wallet} />
      <PerformanceBiasCard summary={data.summary} />
      <YieldRiskCard summary={data.summary} wallet={wallet} tag={data.tag} />
    </div>
  );
}
