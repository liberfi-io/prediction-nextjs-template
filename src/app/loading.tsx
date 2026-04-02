"use client";

import { EventsPageSkeleton } from "@liberfi.io/ui-predict";

export default function Loading() {
  return (
    <div className="flex px-1 py-1 sm:px-0 sm:py-4 max-w-[1680px] mx-auto w-full h-full">
      <EventsPageSkeleton />
    </div>
  );
}
