"use client";

import { atomWithStorage } from "jotai/utils";
import { useAtom } from "jotai";
import { useCallback } from "react";
import { ODDS_FORMATS, type OddsFormat } from "./convert-price";

/**
 * Global odds-format preference, persisted to localStorage so the choice
 * survives reloads and is shared across every World Cup tab. Zero network —
 * switching formats only re-derives display strings from already-loaded prices.
 */
const oddsFormatAtom = atomWithStorage<OddsFormat>(
  "worldcup.oddsFormat",
  "percentage",
);

export function useOddsFormat(): [OddsFormat, (next: OddsFormat) => void] {
  const [format, setFormat] = useAtom(oddsFormatAtom);
  const safe = ODDS_FORMATS.includes(format) ? format : "percentage";
  const set = useCallback((next: OddsFormat) => setFormat(next), [setFormat]);
  return [safe, set];
}
