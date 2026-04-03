"use client";

import { cn } from "@liberfi.io/ui";

function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-default-200/60", className)} />;
}

export default function Loading() {
  return (
    <div className="flex flex-col max-w-[1200px] mx-auto w-full animate-pulse">
      {/* Stats header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 px-4 py-6">
        <div className="flex flex-col gap-2">
          <Bone className="h-4 w-24" />
          <Bone className="h-10 w-36" />
        </div>
        <div className="flex gap-8">
          <div className="flex flex-col items-end gap-1">
            <Bone className="h-3 w-16" />
            <Bone className="h-5 w-12" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Bone className="h-3 w-16" />
            <Bone className="h-5 w-12" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Bone className="h-3 w-16" />
            <Bone className="h-5 w-12" />
          </div>
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div className="flex items-center gap-4 border-b border-default-200 px-4 pb-2">
        <Bone className="h-5 w-24" />
        <Bone className="h-5 w-24" />
        <Bone className="h-5 w-20" />
      </div>

      {/* Table rows skeleton */}
      <div className="flex flex-col gap-3 px-4 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bone key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
