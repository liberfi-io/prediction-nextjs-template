"use client";

import { cn } from "@liberfi.io/ui";

function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-default-200/60", className)} />;
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 px-4 max-sm:px-2 py-4 max-w-[1200px] mx-auto w-full animate-pulse">
      {/* Balance overview skeleton */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:gap-6 p-4 rounded-xl border border-default-200">
        <div className="flex items-center gap-3 flex-1">
          <Bone className="h-7 w-7 rounded-full shrink-0" />
          <div className="flex flex-col gap-1">
            <Bone className="h-3 w-20" />
            <Bone className="h-6 w-28" />
          </div>
        </div>
        <div className="flex gap-6">
          <div className="flex flex-col gap-1">
            <Bone className="h-3 w-24" />
            <Bone className="h-5 w-16" />
          </div>
          <div className="flex flex-col gap-1">
            <Bone className="h-3 w-24" />
            <Bone className="h-5 w-16" />
          </div>
        </div>
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
