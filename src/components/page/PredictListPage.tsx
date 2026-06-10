"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { toast, type LinkComponentType } from "@liberfi.io/ui";
import { EventsPage, usePredictWallet } from "@liberfi.io/ui-predict";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import type { PredictEvent, ProviderSource } from "@liberfi.io/react-predict";
import {
  FUND_WALLET_MODAL_ID,
  type FundWalletParams,
} from "../FundWalletModal";
import { SETUP_WALLET_MODAL_ID } from "../SetupWalletModal";
import { ENABLE_KALSHI } from "../../libs/featureFlags";
import { predictEventHref } from "./predict-source";

const NoPrefetchLink: LinkComponentType = (props) => <Link prefetch={false} {...props} />;

export function PredictListPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { onOpen: openFundWallet } =
    useAsyncModal<FundWalletParams>(FUND_WALLET_MODAL_ID);
  const { onOpen: openSetupWallet } = useAsyncModal(SETUP_WALLET_MODAL_ID);
  const { polymarketSetupVerified, kalshiKycVerified } = usePredictWallet();

  const handleSelect = (event: PredictEvent) => {
    router.push(predictEventHref(event));
  };

  const handleHover = useCallback(
    (event: PredictEvent) => {
      router.prefetch(predictEventHref(event));
    },
    [router],
  );

  const handleInsufficientBalance = useCallback(
    (source: ProviderSource) => {
      // Polymarket account not yet set up → open the same setup modal as the
      // header balance dropdown, not a deposit/balance flow.
      if (source === "polymarket" && !polymarketSetupVerified) {
        void openSetupWallet();
        return;
      }
      // Kalshi unverified → let the fund modal surface the KYC prompt; suppress
      // the misleading "insufficient balance" toast in that case.
      const needsPrerequisite = source === "kalshi" && !kalshiKycVerified;
      if (!needsPrerequisite) {
        toast.error(t("predict.trade.insufficientBalance"));
      }
      openFundWallet({
        params: {
          initialScreen: "deposit",
          initialWallet: source === "polymarket" ? "evm" : "solana",
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

  return (
    <EventsPage
      getEventHref={(event: PredictEvent) => predictEventHref(event)}
      LinkComponent={NoPrefetchLink}
      onHover={handleHover}
      onSelect={handleSelect}
      bgImageSrc="/matches-bg-wide.png"
      onInsufficientBalance={handleInsufficientBalance}
      enableKalshi={ENABLE_KALSHI}
    />
  );
}
