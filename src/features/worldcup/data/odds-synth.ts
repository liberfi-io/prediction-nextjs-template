/**
 * Deterministic odds synthesis for the STATIC preview.
 *
 * The real worldcup BFF will return live Polymarket prices. Until that backend
 * exists, this module derives plausible, stable moneyline / spread / total
 * prices from coarse team-strength ratings plus a slug hash (so the same match
 * always renders the same numbers). NOT real market data — visual fidelity only.
 */

import type { WcMoneyline, WcSpread, WcTotal } from "../types";

/** Coarse 0–100 strength ratings (eyeballed seeding, preview only). */
const STRENGTH: Record<string, number> = {
  BRA: 90, ESP: 90, FRA: 90, ARG: 89, ENG: 87,
  GER: 82, PRT: 82, NLD: 80, BEL: 78,
  URY: 73, HRV: 72, MAR: 70, CHE: 67, COL: 68, JPN: 68, USA: 68, MEX: 66, SEN: 66,
  NOR: 64, TUR: 62, KR: 60, ECU: 60, AUT: 60, CAN: 60, AUS: 58, SWE: 58, CIV: 57, EGY: 57, IRN: 56,
  SCO: 54, ALG: 54, GHA: 52, TUN: 52, PAR: 52, BIH: 50, CZE: 50, NZL: 50,
  PAN: 48, QAT: 46, KSA: 46, UZB: 46, IRQ: 46, CDR: 46, JOR: 44, CVI: 42, RSA: 40, HAI: 38, KOR: 36,
};

function strength(code: string): number {
  return STRENGTH[code.toUpperCase()] ?? 50;
}

/** Stable [0,1) hash from a string (xmur3-ish). */
function hash01(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^= h >>> 16) >>> 0) / 4294967296;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Three-way moneyline probabilities, home edge + closeness-driven draw. */
function threeWay(homeCode: string, awayCode: string, seed: string) {
  const sh = strength(homeCode);
  const sa = strength(awayCode);
  const eh = Math.pow(10, sh / 40);
  const ea = Math.pow(10, sa / 40);
  let pHomeNoDraw = eh / (eh + ea);
  pHomeNoDraw = Math.min(0.92, Math.max(0.08, pHomeNoDraw + 0.05)); // home advantage

  const closeness = 1 - Math.abs(pHomeNoDraw - 0.5) * 2; // 1 even → 0 lopsided
  const pDraw = 0.14 + 0.16 * closeness;
  const rest = 1 - pDraw;

  const jitter = (hash01(seed) - 0.5) * 0.04;
  let pHome = rest * (pHomeNoDraw + jitter);
  let pAway = rest - pHome;

  // Add a small vig so prices sum to ~1.05 (Polymarket-like asks).
  const vig = 1.05;
  pHome = round2(pHome * vig);
  pAway = round2(pAway * vig);
  const pd = round2(pDraw * vig);
  return { pHome, pDraw: pd, pAway };
}

export function synthMoneyline(
  homeCode: string,
  awayCode: string,
  seed: string,
): WcMoneyline {
  const { pHome, pDraw, pAway } = threeWay(homeCode, awayCode, seed);
  return {
    home: { label: homeCode.toUpperCase(), teamCode: homeCode, price: pHome },
    draw: { label: "Draw", price: pDraw },
    away: { label: awayCode.toUpperCase(), teamCode: awayCode, price: pAway },
  };
}

export function synthSpread(
  homeCode: string,
  awayCode: string,
  seed: string,
): WcSpread {
  const diff = strength(homeCode) - strength(awayCode);
  const mag = Math.min(3.5, Math.max(0.5, Math.round(Math.abs(diff) / 12) * 0.5 || 0.5));
  const homeFav = diff >= 0;
  const line = homeFav ? -mag : mag;
  const tilt = (hash01(seed + "s") - 0.5) * 0.06;
  const homePrice = round2(0.5 + tilt);
  const awayPrice = round2(1.02 - homePrice);
  return {
    line,
    home: { label: homeCode.toUpperCase(), teamCode: homeCode, price: homePrice },
    away: { label: awayCode.toUpperCase(), teamCode: awayCode, price: awayPrice },
  };
}

export function synthTotal(
  homeCode: string,
  awayCode: string,
  seed: string,
): WcTotal {
  const avg = (strength(homeCode) + strength(awayCode)) / 2;
  const line = avg > 74 ? 3.5 : avg > 58 ? 2.5 : 2.5;
  const tilt = (hash01(seed + "t") - 0.5) * 0.06;
  const overPrice = round2(0.5 + tilt);
  const underPrice = round2(1.02 - overPrice);
  return {
    line,
    over: { label: "Over", price: overPrice },
    under: { label: "Under", price: underPrice },
  };
}

/** Stable per-match sub-market count for the "match view" pill (33–36). */
export function synthMarketCount(seed: string): number {
  return 33 + Math.floor(hash01(seed + "m") * 4);
}

export { strength as teamStrength };
