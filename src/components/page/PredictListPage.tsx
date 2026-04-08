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
    <EventsPage
      getEventHref={(event: PredictEvent) => predictEventHref(event)}
      LinkComponent={NoPrefetchLink}
      onHover={handleHover}
      onSelect={handleSelect}
      bgImageSrc="/matches-bg-wide.png"
    />
  );
}
