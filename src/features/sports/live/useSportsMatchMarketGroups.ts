"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeCentrifugoJson } from "src/libs/centrifugoJsonClient";
import type { SportsMarketGroup, SportsSection } from "../types";
import {
  isSportsMatchMarketUpdate,
  sportsMatchChannel,
  type SportsMarketPatch,
} from "./channels";
import { mergeSportsMarketPatches } from "./mergeSportsMarketPatches";

export function useSportsMatchMarketGroups(
  section: SportsSection,
  matchGroupSlug: string | undefined,
  initialGroups: SportsMarketGroup[],
): SportsMarketGroup[] {
  const [patches, setPatches] = useState<SportsMarketPatch[]>([]);

  useEffect(() => {
    setPatches([]);
    if (!matchGroupSlug) return;

    const channel = sportsMatchChannel(section, matchGroupSlug, "markets");
    return subscribeCentrifugoJson({
      channel,
      onData: (data) => {
        if (!isSportsMatchMarketUpdate(data)) return;
        if (data.section !== section) return;
        if (data.match_group_slug !== matchGroupSlug) return;
        setPatches(data.markets);
      },
    });
  }, [matchGroupSlug, section]);

  return useMemo(
    () => mergeSportsMarketPatches(initialGroups, patches),
    [initialGroups, patches],
  );
}
