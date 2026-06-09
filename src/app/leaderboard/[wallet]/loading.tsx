import { WalletDetailSkeleton } from "src/features/leaderboard/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto h-[calc(100dvh-116px-env(safe-area-inset-bottom))] w-full max-w-[1280px] px-4 pt-3 sm:h-[calc(100dvh-60px)] sm:px-6 lg:px-10 xl:px-12">
      <WalletDetailSkeleton />
    </div>
  );
}
