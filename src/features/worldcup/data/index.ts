/**
 * Static dataset assembler — turns the embedded fixtures into domain objects
 * the UI consumes. Replaces the worldcup BFF during the static-preview phase.
 */

import type {
  WcBracketNode,
  WcGroup,
  WcMatch,
  WcProp,
  WcStandingRow,
  WcThirdPlaceRow,
} from "../types";
import { getTeam } from "./teams";
import {
  GROUP_MATCHES,
  GROUP_ORDER,
  KNOCKOUT_MATCHES,
  THESPORTS_MATCH_IDS,
} from "./schedule";
import {
  synthMarketCount,
  synthMoneyline,
  synthSpread,
  synthTotal,
  teamStrength,
} from "./odds-synth";
import { buildProps } from "./props";
import { DEMO_STATE_OVERRIDES, deriveStatus } from "../logic/match-status";

export function getMatches(): WcMatch[] {
  return GROUP_MATCHES.map(
    ([matchId, group, home, away, kickoffMs, slug, volume]) => {
      const override = DEMO_STATE_OVERRIDES[matchId];
      const status = override?.status ?? deriveStatus(kickoffMs);
      return {
        matchId,
        stage: `group-${group}`,
        groupCode: group,
        kickoffMs,
        status,
        home: getTeam(home),
        away: getTeam(away),
        slug,
        volume,
        marketCount: synthMarketCount(slug),
        thesportsMatchId: THESPORTS_MATCH_IDS[matchId],
        moneyline: synthMoneyline(home, away, slug),
        spread: synthSpread(home, away, slug),
        total: synthTotal(home, away, slug),
        liveScore: override?.score,
        livePeriod: override?.period,
      };
    },
  );
}

/** Approximate "advance to knockout" probability by intra-group strength rank. */
function advanceByRank(rank: number, spread: number): number {
  const base = [0.9, 0.68, 0.34, 0.12][rank - 1] ?? 0.1;
  return Math.min(0.97, Math.max(0.03, base + spread));
}

export function getGroups(): WcGroup[] {
  return Object.entries(GROUP_ORDER).map(([code, codes]) => {
    const ranked = [...codes].sort((a, b) => teamStrength(b) - teamStrength(a));
    const strongest = teamStrength(ranked[0]);
    const weakest = teamStrength(ranked[ranked.length - 1]);
    const denom = Math.max(1, strongest - weakest);
    const teams: WcStandingRow[] = ranked.map((c, i) => {
      const spread = ((teamStrength(c) - (strongest + weakest) / 2) / denom) * 0.08;
      return {
        rank: i + 1,
        team: getTeam(c),
        p: 0,
        w: 0,
        d: 0,
        l: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        pts: 0,
        form: [null, null, null, null, null],
        advance: Math.round(advanceByRank(i + 1, spread) * 100) / 100,
      };
    });
    return { code, label: `Group ${code}`, teams };
  });
}

/** Number of best third-placed teams that advance to the Round of 32. */
const THIRD_PLACE_QUALIFY = 8;

/**
 * Ranks the 12 group third-placed teams (one per group). The best
 * {@link THIRD_PLACE_QUALIFY} advance to the knockout stage.
 */
export function getBestThirds(): WcThirdPlaceRow[] {
  return getGroups()
    .map((g) => {
      const row = g.teams.find((t) => t.rank === 3);
      return row ? { group: g.code, team: row.team, advance: row.advance } : null;
    })
    .filter((x): x is { group: string; team: WcStandingRow["team"]; advance: number } => x !== null)
    .sort((a, b) => b.advance - a.advance)
    .map((t, i) => ({
      rank: i + 1,
      group: t.group,
      team: t.team,
      advance: t.advance,
      qualifies: i < THIRD_PLACE_QUALIFY,
    }));
}

export function getBracket(): WcBracketNode[] {
  return KNOCKOUT_MATCHES.map(
    ([matchId, round, homeLabel, awayLabel, kickoffMs, venue, city]) => ({
      matchId,
      round,
      homeLabel,
      awayLabel,
      venue,
      city,
      kickoffMs,
    }),
  );
}

export function getProps(): WcProp[] {
  return buildProps();
}
