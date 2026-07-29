"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { toast, type LinkComponentType } from "@liberfi.io/ui";
import { EventsPage, usePredictWallet } from "@liberfi.io/ui-predict";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import {
  useMarketDataResource,
  type MarketDataCapability,
  type MarketDataResourceInput,
  type PredictEvent,
  type PredictMarket,
  type ProviderSource,
} from "@liberfi.io/react-predict";
import {
  FUND_WALLET_MODAL_ID,
  type FundWalletParams,
} from "../FundWalletModal";
import { SETUP_WALLET_MODAL_ID } from "../SetupWalletModal";
import { ENABLE_KALSHI } from "../../libs/featureFlags";
import {
  predictEventAnalyticsParams,
  predictMarketAnalyticsParams,
  trackMatchListView,
  trackOrderClick,
} from "../../lib/analytics";
import { useResolvedApiLang } from "../../i18n/ResolvedLocaleProvider";
import { predictEventHref } from "./predict-source";
import { mergeMarketDataEvent } from "../../features/market-data/resource";

const NoPrefetchLink: LinkComponentType = (props) => (
  <Link prefetch={false} {...props} />
);

export function PredictListPage({
  marketDataCapability,
  marketDataResource,
}: {
  marketDataCapability: MarketDataCapability;
  marketDataResource?: MarketDataResourceInput;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const lang = useResolvedApiLang();
  const { onOpen: openFundWallet } =
    useAsyncModal<FundWalletParams>(FUND_WALLET_MODAL_ID);
  const { onOpen: openSetupWallet } = useAsyncModal(SETUP_WALLET_MODAL_ID);
  const { polymarketSetupVerified, kalshiKycVerified } = usePredictWallet();
  const marketDataState = useMarketDataResource(
    marketDataResource ?? "events:legacy",
  );
  useEffect(() => {
    if (marketDataState.structureInvalidated) router.refresh();
  }, [marketDataState.structureInvalidated, router]);
  const getMarketDataEvent = useCallback(
    (event: PredictEvent) =>
      marketDataCapability.enabled
        ? mergeMarketDataEvent(event, marketDataState)
        : undefined,
    [marketDataCapability.enabled, marketDataState],
  );

  useEffect(() => {
    trackMatchListView({ listName: "events" });
  }, []);

  const handleSelect = (event: PredictEvent) => {
    router.push(predictEventHref(event));
  };

  const handleSelectOutcome = useCallback(
    (event: PredictEvent, market: PredictMarket, outcome: "yes" | "no") => {
      trackOrderClick({
        ...predictEventAnalyticsParams(event),
        ...predictMarketAnalyticsParams(market),
        outcome,
        side: "buy",
        surface: "events_list",
      });
    },
    [],
  );

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
      onSelectOutcome={handleSelectOutcome}
      bgImageSrc="/matches-bg-wide.png"
      onInsufficientBalance={handleInsufficientBalance}
      enableKalshi={ENABLE_KALSHI}
      lang={lang}
      marketDataCapability={marketDataCapability}
      getMarketDataEvent={getMarketDataEvent}
    />
  );
}
