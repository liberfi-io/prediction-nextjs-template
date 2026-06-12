import type { WcGroup, WcStandingRow } from "../../types";

/**
 * Temporary front-end standings override.
 *
 * The backend standings endpoint is still served by a static, all-zero
 * pre-tournament provider, so finished matches are not reflected yet. Until the
 * results-driven backend provider lands, we recompute the affected group tables
 * on the client from a hard-coded list of finished results.
 *
 * Remove this module (and its use in GroupsTab) once the backend returns live
 * standings.
 */
interface FinishedResult {
  groupCode: string;
  /** Team codes (case-insensitive). */
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
}

const FINISHED_RESULTS: FinishedResult[] = [
  // M1 Mexico 2-0 South Africa
  { groupCode: "A", home: "MEX", away: "RSA", homeGoals: 2, awayGoals: 0 },
  // M2 Korea Rep. 2-1 Czechia
  { groupCode: "A", home: "KR", away: "CZE", homeGoals: 2, awayGoals: 1 },
];

const FORM_LENGTH = 5;

/** FIFA group tiebreaker: points, goal difference, goals for, then code. */
function standingLess(a: WcStandingRow, b: WcStandingRow): number {
  if (a.pts !== b.pts) return b.pts - a.pts;
  if (a.gd !== b.gd) return b.gd - a.gd;
  if (a.gf !== b.gf) return b.gf - a.gf;
  return a.team.code.localeCompare(b.team.code);
}

function recomputeRow(row: WcStandingRow, results: FinishedResult[]): WcStandingRow {
  const code = row.team.code.toLowerCase();
  let p = 0;
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  const form: Array<"W" | "D" | "L" | null> = [];

  for (const r of results) {
    let mine: number | null = null;
    let opp = 0;
    if (r.home.toLowerCase() === code) {
      mine = r.homeGoals;
      opp = r.awayGoals;
    } else if (r.away.toLowerCase() === code) {
      mine = r.awayGoals;
      opp = r.homeGoals;
    }
    if (mine == null) continue;
    p += 1;
    gf += mine;
    ga += opp;
    if (mine > opp) {
      w += 1;
      form.push("W");
    } else if (mine === opp) {
      d += 1;
      form.push("D");
    } else {
      l += 1;
      form.push("L");
    }
  }

  const paddedForm = [...form];
  while (paddedForm.length < FORM_LENGTH) paddedForm.push(null);

  return {
    ...row,
    p,
    w,
    d,
    l,
    gf,
    ga,
    gd: gf - ga,
    pts: w * 3 + d,
    form: paddedForm.slice(0, FORM_LENGTH),
  };
}

/**
 * Recompute any group that has finished results, ranking by the FIFA
 * tiebreaker. Groups without results pass through untouched.
 */
export function applyStandingsOverride(groups: WcGroup[]): WcGroup[] {
  const affected = new Set(FINISHED_RESULTS.map((r) => r.groupCode));
  return groups.map((g) => {
    if (!affected.has(g.code)) return g;
    const results = FINISHED_RESULTS.filter((r) => r.groupCode === g.code);
    const teams = g.teams
      .map((row) => recomputeRow(row, results))
      .sort(standingLess)
      .map((row, i) => ({ ...row, rank: i + 1 }));
    return { ...g, teams };
  });
}
