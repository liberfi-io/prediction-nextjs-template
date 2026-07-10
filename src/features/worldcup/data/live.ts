"use client";

import { useEffect, useState } from "react";
import { subscribeCentrifugoJson } from "../../../libs/centrifugoJsonClient";
import {
  adaptLiveState,
  adaptLiveStats,
  EMPTY_WORLDCUP_MARKET_REALTIME,
  type WorldcupMarketRealtimeState,
  type WorldcupMatchLiveUpdate,
  type WorldcupMatchStatsUpdate,
} from "./client";
import type { WcLiveStats, WcMatchLiveState } from "../types";

const CHANNEL = "worldcup.matches";
const MATCH_CHANNEL_PREFIX = "worldcup.match.";

function isLiveUpdate(value: unknown): value is WorldcupMatchLiveUpdate {
  const update = value as WorldcupMatchLiveUpdate;
  return (
    update?.type === "worldcup.match.live_update" &&
    typeof update.match_id === "string" &&
    typeof update.event_slug === "string" &&
    Boolean(update.state)
  );
}

function isStatsUpdate(value: unknown): value is WorldcupMatchStatsUpdate {
  const update = value as WorldcupMatchStatsUpdate;
  return (
    update?.type === "worldcup.match.stats_update" &&
    typeof update.match_id === "string" &&
    Boolean(update.stats)
  );
}

function shouldReplace(
  current: WcMatchLiveState | undefined,
  incoming: WcMatchLiveState,
): boolean {
  if (!current?.updatedAt || !incoming.updatedAt) return true;
  const currentMs = Date.parse(current.updatedAt);
  const incomingMs = Date.parse(incoming.updatedAt);
  if (Number.isNaN(currentMs) || Number.isNaN(incomingMs)) return true;
  return incomingMs >= currentMs;
}

export interface WorldcupRealtimeState {
  liveStates: Record<string, WcMatchLiveState>;
  marketState: WorldcupMarketRealtimeState;
}

export function useWorldcupRealtime(): WorldcupRealtimeState {
  const [states, setStates] = useState<Record<string, WcMatchLiveState>>({});

  useEffect(() => {
    const applyUpdate = (update: WorldcupMatchLiveUpdate) => {
      const state = adaptLiveState(update.state);
      if (!state) return;
      setStates((current) => {
        const prev = current[state.matchId];
        if (!shouldReplace(prev, state)) return current;
        return { ...current, [state.matchId]: state };
      });
    };

    return subscribeCentrifugoJson({
      channel: CHANNEL,
      onData: (data) => {
        if (isLiveUpdate(data)) applyUpdate(data);
      },
    });
  }, []);

  return {
    liveStates: states,
    marketState: EMPTY_WORLDCUP_MARKET_REALTIME,
  };
}

export function useWorldcupLiveUpdates(): Record<string, WcMatchLiveState> {
  return useWorldcupRealtime().liveStates;
}

/**
 * Subscribe to a single match's live state via its per-match Centrifugo channel
 * (`worldcup.match.<matchId>.live`). Unlike {@link useWorldcupRealtime}, this
 * only receives the one match the detail page cares about and never parses the
 * market-update fan-out, so the detail page no longer rides the whole-tournament
 * broadcast. Returns `undefined` until the first live frame arrives.
 */
export function useWorldcupMatchLive(
  matchId: string | undefined,
): WcMatchLiveState | undefined {
  const [state, setState] = useState<WcMatchLiveState | undefined>(undefined);

  useEffect(() => {
    setState(undefined);
    if (!matchId) return;

    const channel = `${MATCH_CHANNEL_PREFIX}${matchId}.live`;

    const applyUpdate = (update: WorldcupMatchLiveUpdate) => {
      const next = adaptLiveState(update.state);
      if (!next || next.matchId !== matchId) return;
      setState((current) => (shouldReplace(current, next) ? next : current));
    };

    return subscribeCentrifugoJson({
      channel,
      onData: (data) => {
        if (isLiveUpdate(data)) applyUpdate(data);
      },
    });
  }, [matchId]);

  return state;
}

export function useWorldcupMatchStats(
  matchId: string | undefined,
): WcLiveStats | undefined {
  const [stats, setStats] = useState<WcLiveStats | undefined>(undefined);

  useEffect(() => {
    setStats(undefined);
    if (!matchId) return;

    const channel = `${MATCH_CHANNEL_PREFIX}${matchId}.stats`;

    const applyUpdate = (update: WorldcupMatchStatsUpdate) => {
      if (update.match_id !== matchId) return;
      const next = adaptLiveStats(update.stats);
      if (!next) return;
      setStats(next);
    };

    return subscribeCentrifugoJson({
      channel,
      onData: (data) => {
        if (isStatsUpdate(data)) applyUpdate(data);
      },
    });
  }, [matchId]);

  return stats;
}
