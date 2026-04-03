"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LinkComponentType } from "@liberfi.io/ui";
import { MatchesPage } from "@liberfi.io/ui-predict";
import type { PredictEvent } from "@liberfi.io/react-predict";
import { predictEventHref } from "./predict-source";

const NoPrefetchLink: LinkComponentType = (props) => (
  <Link prefetch={false} {...props} />
);

export function PredictMatchesPage() {
  const router = useRouter();

  const handleSelectEntry = useCallback(
    (event: PredictEvent) => {
      router.push(predictEventHref(event));
    },
    [router],
  );

  return (
    <MatchesPage
      onSelectEntry={handleSelectEntry}
      getEventHref={predictEventHref}
      LinkComponent={NoPrefetchLink}
      bgImageSrc="/matches-bg.webp"
    />
  );
}
