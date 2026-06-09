"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { toast, type LinkComponentType } from "@liberfi.io/ui";
import { EventsPage } from "@liberfi.io/ui-predict";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import type { PredictEvent, ProviderSource } from "@liberfi.io/react-predict";
import {
  FUND_WALLET_MODAL_ID,
  type FundWalletParams,
} from "../FundWalletModal";
import { ENABLE_KALSHI } from "../../libs/featureFlags";
import { predictEventHref } from "./predict-source";

const NoPrefetchLink: LinkComponentType = (props) => <Link prefetch={false} {...props} />;

export function PredictListPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { onOpen: openFundWallet } =
    useAsyncModal<FundWalletParams>(FUND_WALLET_MODAL_ID);

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
      toast.error(t("predict.trade.insufficientBalance"));
      openFundWallet({
        params: {
          initialScreen: "deposit",
          initialWallet: source === "polymarket" ? "evm" : "solana",
        },
      });
    },
    [openFundWallet, t],
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
