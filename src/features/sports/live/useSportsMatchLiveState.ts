"use client";

import { useEffect, useState } from "react";
import { subscribeCentrifugoJson } from "src/libs/centrifugoJsonClient";
import type { SportsLiveState, SportsSection } from "../types";
import {
  isSportsMatchStateUpdate,
  sportsMatchChannel,
  type SportsMatchStateUpdate,
} from "./channels";

export function useSportsMatchLiveState(
  section: SportsSection,
  matchGroupSlug: string | undefined,
): SportsLiveState | undefined {
  const [state, setState] = useState<SportsLiveState | undefined>(undefined);

  useEffect(() => {
    setState(undefined);
    if (!matchGroupSlug) return;

    const channel = sportsMatchChannel(section, matchGroupSlug, "state");

    return subscribeCentrifugoJson({
      channel,
      onData: (data) => {
        if (!isSportsMatchStateUpdate(data)) return;
        if (data.section !== section) return;
        if (data.match_group_slug !== matchGroupSlug) return;

        setState((current) => {
          if (!shouldReplace(current, data)) return current;
          return toLiveState(data);
        });
      },
    });
  }, [matchGroupSlug, section]);

  return state;
}

function shouldReplace(
  current: SportsLiveState | undefined,
  incoming: SportsMatchStateUpdate,
): boolean {
  if (!current?.observed_at_unix_ms || !incoming.observed_at_unix_ms) {
    return true;
  }
  return incoming.observed_at_unix_ms >= current.observed_at_unix_ms;
}

function toLiveState(update: SportsMatchStateUpdate): SportsLiveState {
  return {
    status: update.status,
    status_text: update.status_text,
    clock: update.clock,
    period: update.period,
    score_state: update.score_state,
    observed_at_unix_ms: update.observed_at_unix_ms,
  };
}
