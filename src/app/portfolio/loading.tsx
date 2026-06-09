"use client";

import { PortfolioSkeleton } from "src/components/page/portfolio-skeleton";

export default function Loading() {
  return (
    <div className="bg-zinc-950/50 sm:h-[calc(100vh-var(--header-height))] sm:min-h-0 sm:overflow-hidden">
      <div className="mx-auto h-full max-w-[1200px] px-2 pt-3 sm:flex sm:flex-col sm:px-6 sm:pt-8 lg:px-8">
        <PortfolioSkeleton />
      </div>
    </div>
  );
}
