"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  buildLeaderboardSearch,
  leaderboardTagForScope,
  type LeaderboardScope,
} from "../routeParams";
import type { LeaderboardInterval } from "../types";
import { WalletDetailPanel } from "./WalletDetailPanel";

export function WalletDetailPage({
  wallet,
  interval,
  scope,
}: {
  wallet: string;
  interval: LeaderboardInterval;
  scope: LeaderboardScope;
}) {
  const router = useRouter();
  const tag = leaderboardTagForScope(scope);

  const handleBack = useCallback(() => {
    router.push(`/leaderboard${buildLeaderboardSearch({ interval, scope })}`, {
      scroll: false,
    });
  }, [interval, router, scope]);

  return (
    <div className="mx-auto h-[calc(100dvh-116px-env(safe-area-inset-bottom))] w-full max-w-[1280px] px-4 pt-3 sm:h-[calc(100dvh-60px)] sm:px-6 lg:px-10 xl:px-12">
      <WalletDetailPanel
        key={wallet}
        wallet={wallet}
        interval={interval}
        tag={tag}
        onBack={handleBack}
      />
    </div>
  );
}
