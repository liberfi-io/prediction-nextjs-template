"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LinkComponentType } from "@liberfi.io/ui";
import { EventsPage } from "@liberfi.io/ui-predict";
import type { PredictEvent } from "@liberfi.io/react-predict";
import { predictEventHref } from "./predict-source";

const NoPrefetchLink: LinkComponentType = (props) => <Link prefetch={false} {...props} />;

export function PredictListPage() {
  const router = useRouter();

  const handleSelect = (event: PredictEvent) => {
    router.push(predictEventHref(event));
  };

  const handleHover = useCallback(
    (event: PredictEvent) => {
      router.prefetch(predictEventHref(event));
    },
    [router],
  );

  return (
    <div className="flex px-1 py-1 sm:px-0 sm:py-4 max-w-[1680px] mx-auto w-full h-full">
      <EventsPage
        getEventHref={(event: PredictEvent) => predictEventHref(event)}
        LinkComponent={NoPrefetchLink}
        onHover={handleHover}
        onSelect={handleSelect}
      />
    </div>
  );
}
