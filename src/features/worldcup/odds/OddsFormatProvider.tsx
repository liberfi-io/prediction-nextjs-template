"use client";

import { atomWithStorage } from "jotai/utils";
import { useAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { ODDS_FORMATS, type OddsFormat } from "./convert-price";

type StoredOddsFormat = OddsFormat | "european";

/**
 * Global odds-format preference, persisted to localStorage so the choice
 * survives reloads and is shared across every World Cup tab. Zero network —
 * switching formats only re-derives display strings from already-loaded prices.
 */
const oddsFormatAtom = atomWithStorage<StoredOddsFormat>(
  "worldcup.oddsFormat",
  "decimal",
);

export function useOddsFormat(): [OddsFormat, (next: OddsFormat) => void] {
  const [format, setFormat] = useAtom(oddsFormatAtom);
  const safe = ODDS_FORMATS.includes(format as OddsFormat)
    ? (format as OddsFormat)
    : "decimal";
  useEffect(() => {
    if (format !== safe) setFormat(safe);
  }, [format, safe, setFormat]);
  const set = useCallback((next: OddsFormat) => setFormat(next), [setFormat]);
  return [safe, set];
}
