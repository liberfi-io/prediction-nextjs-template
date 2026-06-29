"use client";

import { useState } from "react";
import { useTranslation } from "@liberfi.io/i18n";
import { Chain } from "@liberfi.io/types";
import { usePositionsMulti } from "@liberfi.io/react-predict";
import { cn, EmptyIcon, SignInIcon } from "@liberfi.io/ui";
import { useAuth, useConnectedWallet } from "@liberfi.io/wallet-connector";
import { PredictSellModal } from "@liberfi.io/ui-predict";
import {
  PositionsPanel,
  OrdersPanel,
  TradesPanel,
  type ActivityTab,
} from "./portfolio-activity";
import { ENABLE_KALSHI } from "../../libs/featureFlags";
import { PredictRedeemModal } from "../PredictRedeemModal";

/**
 * Embeddable portfolio activity (positions / open orders / trade history).
 *
 * Renders the same multi-source queries, content and styling as the standalone
 * portfolio page, but in a fixed-height (non flex-fill) layout suitable for
 * embedding at the bottom of a detail page. Always shows the user's full
 * activity across every event (no per-event filtering).
 */
export function PortfolioActivitySection({
  activeTab: controlledTab,
  hideTabs = false,
}: {
  /** Externally controlled tab (mobile flattens these into top-level tabs). */
  activeTab?: ActivityTab;
  /** Hide the internal tab bar when the tab is driven externally. */
  hideTabs?: boolean;
}) {
  const { t } = useTranslation();
  const { status: authStatus, signIn } = useAuth();
  const [internalTab, setInternalTab] = useState<ActivityTab>("positions");
  const activeTab = controlledTab ?? internalTab;

  const solanaWallet = useConnectedWallet(Chain.SOLANA);
  const evmWallet = useConnectedWallet(Chain.POLYGON);
  const solanaAddr = solanaWallet?.address ?? "";
  const evmAddr = evmWallet?.address ?? "";

  const isAuthenticated = authStatus === "authenticated";

  const { data: positionsData, isLoading: positionsLoading } = usePositionsMulti(
    {
      kalshi_user: ENABLE_KALSHI ? solanaAddr || undefined : undefined,
      polymarket_user: evmAddr || undefined,
    },
    { enabled: isAuthenticated && Boolean(solanaAddr || evmAddr) },
  );

  const allPositions = positionsData?.positions ?? [];
  const positionsCount = allPositions.length;
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
    <div className={cn("flex flex-col", hideTabs ? "" : "px-1 lg:px-4")}>
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
      {!isAuthenticated ? (
        <SignInPrompt
          message={t("extend.portfolio.signInPrompt")}
          buttonLabel={t("common.signIn")}
          onSignIn={signIn}
        />
      ) : (
        <div className="flex flex-col">
          {activeTab === "positions" && (
            <PositionsPanel
              positions={allPositions}
              isLoading={positionsLoading}
              search=""
              fill={false}
            />
          )}
          {activeTab === "orders" && (
            <OrdersPanel solanaAddr={solanaAddr} evmAddr={evmAddr} fill={false} />
          )}
          {activeTab === "history" && (
            <TradesPanel solanaAddr={solanaAddr} evmAddr={evmAddr} fill={false} />
          )}
        </div>
      )}

      {/* Sell / Redeem modals triggered by the embedded positions list. Mounted
          here so the action buttons work wherever this section is embedded
          (e.g. the World Cup detail page, which doesn't use EventDetailPage). */}
      <PredictSellModal />
      <PredictRedeemModal />
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
