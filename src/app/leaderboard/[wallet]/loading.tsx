import { WalletDetailSkeleton } from "src/features/leaderboard/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto h-full w-full max-w-[1280px] px-2 pt-3 sm:px-6 lg:px-10 xl:px-12">
      <WalletDetailSkeleton />
    </div>
  );
}
