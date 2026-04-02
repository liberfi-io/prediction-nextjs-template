"use client";

import { cn } from "@liberfi.io/ui";

function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-default-200/60", className)} />;
}

function MarketRow() {
  return (
    <div className="flex items-center gap-x-3 px-2 py-3 lg:gap-x-4">
      <Bone className="h-4 flex-1" />
      <Bone className="h-5 w-10 shrink-0" />
      <div className="flex gap-x-2">
        <Bone className="h-8 w-16 rounded-lg" />
        <Bone className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="w-full flex flex-col gap-4 lg:gap-y-6 px-1 lg:px-4 lg:max-w-3xl">
      <div className="flex items-center gap-x-3 lg:gap-x-4">
        <Bone className="h-14 w-14 shrink-0 rounded-lg lg:h-18 lg:w-18" />
        <div className="flex flex-col gap-y-1.5 min-w-0 flex-1">
          <Bone className="h-3 w-24 lg:w-32" />
          <Bone className="h-5 w-48 lg:h-6 lg:w-72" />
        </div>
      </div>
      <Bone className="h-[200px] w-full rounded-xl lg:h-[280px]" />
      <div className="flex items-center justify-between">
        <Bone className="h-3 w-32" />
        <div className="flex gap-x-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-7 w-10" />
          ))}
        </div>
      </div>
      <div className="flex flex-col divide-y divide-default-200">
        {Array.from({ length: 4 }).map((_, i) => (
          <MarketRow key={i} />
        ))}
      </div>
    </div>
  );
}

function TradeSkeleton() {
  return (
    <div className="flex w-full flex-col gap-y-4 rounded-xl border border-default-200 bg-content1 p-4">
      <div className="flex items-center gap-x-3">
        <Bone className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="flex flex-col gap-y-1 flex-1">
          <Bone className="h-3 w-28" />
          <Bone className="h-4 w-40" />
        </div>
      </div>
      <div className="flex gap-x-4">
        <Bone className="h-4 w-12" />
        <Bone className="h-4 w-12" />
      </div>
      <div className="flex gap-x-2">
        <Bone className="h-10 flex-1 rounded-lg" />
        <Bone className="h-10 flex-1 rounded-lg" />
      </div>
      <Bone className="h-14 w-full rounded-lg" />
      <Bone className="h-12 w-full rounded-lg" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className={cn("w-full h-full px-4 max-sm:px-0 flex flex-col gap-2.5 overflow-y-auto")}>
      <div className="p-2 sm:p-4 flex w-full max-w-[1550px] mx-auto">
        <div className="flex w-full max-w-6xl mx-auto gap-x-4 lg:gap-x-6 animate-pulse">
          <div className="min-w-0 flex-1 max-w-3xl">
            <DetailSkeleton />
          </div>
          <aside className="hidden lg:block w-[340px] xl:w-[380px] shrink-0">
            <div className="sticky top-4">
              <TradeSkeleton />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
