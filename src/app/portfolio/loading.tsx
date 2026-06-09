"use client";

import { cn } from "@liberfi.io/ui";
import {
  PerformanceBiasCardSkeleton,
  TotalValueCardSkeleton,
  YieldRiskCardSkeleton,
} from "src/features/leaderboard/components/skeletons";

function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-default-200/60", className)} />;
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 px-4 max-sm:px-2 py-4 max-w-[1200px] mx-auto w-full animate-pulse">
      {/* Summary panels skeleton — total value / performance & bias / yield & risk */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TotalValueCardSkeleton />
        <PerformanceBiasCardSkeleton />
        <YieldRiskCardSkeleton />
      </div>

      {/* Tab bar skeleton */}
      <div className="flex items-center gap-4 border-b border-default-200 pb-2">
        <Bone className="h-5 w-20" />
        <Bone className="h-5 w-24" />
        <Bone className="h-5 w-28" />
      </div>

      {/* Table rows skeleton */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
