"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@liberfi.io/ui";
import { Chain } from "@liberfi.io/types";
import { EventDetailPage } from "@liberfi.io/ui-predict";
import { useSimilarEvents } from "@liberfi.io/react-predict";
import type { ProviderSource } from "@liberfi.io/react-predict";
import { useConnectedWallet } from "@liberfi.io/wallet-connector";
import { predictEventHref } from "./predict-source";
import { EventActivitySection } from "./EventActivitySection";

export function PredictDetailPage({ id, source }: { id: string; source: ProviderSource }) {
  const router = useRouter();

  const solanaWallet = useConnectedWallet(Chain.SOLANA);
  const evmWallet = useConnectedWallet(Chain.POLYGON);

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
        />
      </div>
    </div>
  );
}
