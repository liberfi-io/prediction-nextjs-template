import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { WalletDetailPage } from "src/features/leaderboard/components/WalletDetailPage";
import { WalletDetailSkeleton } from "src/features/leaderboard/components/skeletons";
import {
  prefetchWalletDailyPnl,
  prefetchWalletPnl,
} from "src/features/leaderboard/data/prefetch";
import {
  leaderboardTagForScope,
  parseInterval,
  parseScope,
} from "src/features/leaderboard/routeParams";
import { detectLanguage } from "src/i18n/detectLanguage";
import { mapToApiLang } from "src/i18n/locales";
import { createServerQueryClient } from "src/libs/server/queryClient";

const PREFETCH_TIMEOUT_MS = 3000;

async function WalletDetailContent({
  wallet,
  searchParams,
}: {
  wallet: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const interval = parseInterval(searchParams.interval);
  const scope = parseScope(searchParams.scope);
  const tag = leaderboardTagForScope(scope);
  const queryClient = createServerQueryClient();
  const lang = mapToApiLang(await detectLanguage());

  await Promise.race([
    Promise.all([
      prefetchWalletPnl(queryClient, wallet, lang, interval, tag),
      prefetchWalletDailyPnl(queryClient, wallet, lang, interval, tag),
    ]),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("prefetch timeout")), PREFETCH_TIMEOUT_MS),
    ),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WalletDetailPage wallet={wallet} interval={interval} scope={scope} />
    </HydrationBoundary>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ wallet: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ wallet }, sp] = await Promise.all([params, searchParams]);

  return (
    <Suspense
      fallback={
        <div className="mx-auto h-[calc(100dvh-116px-env(safe-area-inset-bottom))] w-full max-w-[1280px] px-4 pt-3 sm:h-[calc(100dvh-60px)] sm:px-6 lg:px-10 xl:px-12">
          <WalletDetailSkeleton />
        </div>
      }
    >
      <WalletDetailContent wallet={wallet} searchParams={sp} />
    </Suspense>
  );
}
