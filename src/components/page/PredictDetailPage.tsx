"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslation } from "@liberfi.io/i18n";
import { cn, toast } from "@liberfi.io/ui";
import { Chain } from "@liberfi.io/types";
import {
  EventDetailPage,
  usePredictWallet,
  type EventMarketDataBookSelection,
} from "@liberfi.io/ui-predict";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import {
  eventQueryKey,
  similarEventsQueryKey,
  useMarketDataResource,
  useSimilarEvents,
  type MarketDataCapability,
  type MarketDataResourceInput,
  type PredictEvent,
  type ProviderSource,
} from "@liberfi.io/react-predict";
import { useConnectedWallet } from "@liberfi.io/wallet-connector";
import {
  FUND_WALLET_MODAL_ID,
  type FundWalletParams,
} from "../FundWalletModal";
import { SETUP_WALLET_MODAL_ID } from "../SetupWalletModal";
import { trackMatchDetailView } from "../../lib/analytics";
import { useResolvedApiLang } from "../../i18n/ResolvedLocaleProvider";
import { predictEventHref } from "./predict-source";
import { EventActivitySection } from "./EventActivitySection";
import {
  eventOrderbooksFromMarketDataState,
  mergeMarketDataEvent,
  withEventMarketDataSelectedBook,
} from "../../features/market-data/resource";

export function PredictDetailPage({
  id,
  source,
  marketDataCapability,
  marketDataResource,
}: {
  id: string;
  source: ProviderSource;
  marketDataCapability: MarketDataCapability;
  marketDataResource?: MarketDataResourceInput;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const lang = useResolvedApiLang();
  const { onOpen: openFundWallet } =
    useAsyncModal<FundWalletParams>(FUND_WALLET_MODAL_ID);
  const { onOpen: openSetupWallet } = useAsyncModal(SETUP_WALLET_MODAL_ID);

  const solanaWallet = useConnectedWallet(Chain.SOLANA);
  const evmWallet = useConnectedWallet(Chain.POLYGON);
  const { polymarketSetupVerified, kalshiKycVerified } = usePredictWallet();
  const [bookSelectionState, setBookSelectionState] = useState<{
    resourceKey: string;
    selection:
      | (EventMarketDataBookSelection & { source: ProviderSource })
      | null;
  }>();
  const selectedBook =
    bookSelectionState &&
    bookSelectionState.resourceKey === marketDataResource?.key
      ? bookSelectionState.selection
      : undefined;
  const activeMarketDataResource = useMemo(
    () =>
      marketDataResource && selectedBook !== undefined
        ? withEventMarketDataSelectedBook(marketDataResource, selectedBook)
        : marketDataResource,
    [marketDataResource, selectedBook],
  );
  const marketDataState = useMarketDataResource(
    activeMarketDataResource ?? `event:${source}:${id}:legacy`,
  );
  const event = queryClient.getQueryData<PredictEvent>(
    eventQueryKey(id, source, lang),
  );
  const marketDataEvent =
    marketDataCapability.enabled && event
      ? mergeMarketDataEvent(event, marketDataState)
      : undefined;
  const marketDataOrderbooks = useMemo(
    () =>
      marketDataCapability.enabled
        ? eventOrderbooksFromMarketDataState(marketDataState)
        : undefined,
    [marketDataCapability.enabled, marketDataState],
  );
  useEffect(() => {
    if (marketDataState.structureInvalidated) router.refresh();
  }, [marketDataState.structureInvalidated, router]);

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
    { slug: id, source, limit: 4, lang },
    { staleTime: Infinity },
  );

  useEffect(() => {
    void queryClient.invalidateQueries({
      queryKey: eventQueryKey(id, source, lang),
    });
    void queryClient.invalidateQueries({
      queryKey: similarEventsQueryKey(id, source, { limit: 4, lang }),
    });
  }, [id, source, lang, queryClient]);

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
  const handleMarketDataBookSelectionChange = useCallback(
    (selection: EventMarketDataBookSelection | null) => {
      if (!marketDataResource) return;
      setBookSelectionState({
        resourceKey: marketDataResource.key,
        selection: selection ? { ...selection, source } : null,
      });
    },
    [marketDataResource, source],
  );

  return (
    <div
      className={cn(
        "w-full h-full lg:px-4 flex flex-col gap-2.5 overflow-y-auto",
      )}
    >
      <div className="p-2 lg:p-4 flex w-full max-w-[1550px] mx-auto">
        <EventDetailPage
          eventSlug={id}
          source={source}
          lang={lang}
          walletAddress={walletAddress}
          onSimilarEventClick={handleSimilarEventClick}
          onBack={() => router.back()}
          renderActivitySection={({ event, walletAddress: addr }) => (
            <EventActivitySection event={event} walletAddress={addr} />
          )}
          onInsufficientBalance={handleInsufficientBalance}
          onSetupRequired={handleSetupRequired}
          marketDataCapability={marketDataCapability}
          marketDataEvent={marketDataEvent}
          marketDataOrderbooks={marketDataOrderbooks}
          onMarketDataBookSelectionChange={
            marketDataCapability.enabled
              ? handleMarketDataBookSelectionChange
              : undefined
          }
        />
      </div>
    </div>
  );
}
