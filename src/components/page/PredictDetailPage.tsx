"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { cn, toast } from "@liberfi.io/ui";
import { Chain } from "@liberfi.io/types";
import { EventDetailPage, usePredictWallet } from "@liberfi.io/ui-predict";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import { useSimilarEvents } from "@liberfi.io/react-predict";
import type { ProviderSource } from "@liberfi.io/react-predict";
import { useConnectedWallet } from "@liberfi.io/wallet-connector";
import {
  FUND_WALLET_MODAL_ID,
  type FundWalletParams,
} from "../FundWalletModal";
import { SETUP_WALLET_MODAL_ID } from "../SetupWalletModal";
import { trackMatchDetailView } from "../../lib/analytics";
import { predictEventHref } from "./predict-source";
import { EventActivitySection } from "./EventActivitySection";

export function PredictDetailPage({ id, source }: { id: string; source: ProviderSource }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { onOpen: openFundWallet } =
    useAsyncModal<FundWalletParams>(FUND_WALLET_MODAL_ID);
  const { onOpen: openSetupWallet } = useAsyncModal(SETUP_WALLET_MODAL_ID);

  const solanaWallet = useConnectedWallet(Chain.SOLANA);
  const evmWallet = useConnectedWallet(Chain.POLYGON);
  const { polymarketSetupVerified, kalshiKycVerified } = usePredictWallet();

  useEffect(() => {
    trackMatchDetailView({
      eventSlug: id,
      source,
      surface: "prediction_detail",
    });
  }, [id, source]);

  const walletAddress =
    source === "kalshi"
      ? (solanaWallet?.address ?? "")
      : (evmWallet?.address ?? "");

  const { data: similarEvents } = useSimilarEvents(
    { slug: id, source, limit: 4 },
    { staleTime: Infinity },
  );

  useEffect(() => {
    similarEvents?.forEach((ev) => router.prefetch(predictEventHref(ev)));
  }, [similarEvents, router]);

  const handleSimilarEventClick = useCallback(
    (event: { slug: string; source: ProviderSource }) => {
      router.push(predictEventHref(event));
    },
    [router],
  );

  const handleInsufficientBalance = useCallback(
    (src: ProviderSource) => {
      // Polymarket account not yet set up → open the same setup modal as the
      // header balance dropdown, not a deposit/balance flow.
      if (src === "polymarket" && !polymarketSetupVerified) {
        void openSetupWallet();
        return;
      }
      // Kalshi unverified → let the fund modal surface the KYC prompt; suppress
      // the misleading "insufficient balance" toast in that case.
      const needsPrerequisite = src === "kalshi" && !kalshiKycVerified;
      if (!needsPrerequisite) {
        toast.error(t("predict.trade.insufficientBalance"));
      }
      openFundWallet({
        params: {
          initialScreen: "deposit",
          initialWallet: src === "polymarket" ? "evm" : "solana",
        },
      });
    },
    [
      openFundWallet,
      openSetupWallet,
      t,
      polymarketSetupVerified,
      kalshiKycVerified,
    ],
  );

  // Open the shared Polymarket account setup modal (same as the header).
  const handleSetupRequired = useCallback(() => {
    void openSetupWallet();
  }, [openSetupWallet]);

  return (
    <div className={cn("w-full h-full lg:px-4 flex flex-col gap-2.5 overflow-y-auto")}>
      <div className="p-2 lg:p-4 flex w-full max-w-[1550px] mx-auto">
        <EventDetailPage
          eventSlug={id}
          source={source}
          walletAddress={walletAddress}
          onSimilarEventClick={handleSimilarEventClick}
          onBack={() => router.back()}
          renderActivitySection={({ event, walletAddress: addr }) => (
            <EventActivitySection event={event} walletAddress={addr} />
          )}
          onInsufficientBalance={handleInsufficientBalance}
          onSetupRequired={handleSetupRequired}
        />
      </div>
    </div>
  );
}
