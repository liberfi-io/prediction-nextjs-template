import type { WcMatchStatus } from "../types";

/** Nominal match length used to decide the live window (90' + stoppage/HT). */
const MATCH_WINDOW_MS = 110 * 60 * 1000;

/**
 * Demo state overrides for the STATIC preview. Currently empty so every match
 * derives its status from kickoff time (all future = scheduled). Add entries
 * here to force `live` / `final` cards when testing those states.
 */
export const DEMO_STATE_OVERRIDES: Record<
  string,
  {
    status: WcMatchStatus;
    score?: { home: number; away: number };
    period?: string;
  }
> = {};

/** Derive status purely from kickoff vs. now (all future = scheduled). */
export function deriveStatus(kickoffMs: number, now = Date.now()): WcMatchStatus {
  if (now < kickoffMs) return "scheduled";
  if (now < kickoffMs + MATCH_WINDOW_MS) return "live";
  return "final";
}
