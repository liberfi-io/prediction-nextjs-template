import { resolveSportsTaxonomyIcon } from "./sportsTaxonomyIcons";
import { existsSync } from "node:fs";
import { join } from "node:path";

const CURRENT_TAXONOMY_SLUGS = [
  "soccer",
  "world-cup",
  "csl",
  "mls",
  "bol1",
  "nor",
  "bra2",
  "swe",
  "bra",
  "mex",
  "rou1",
  "aus",
  "per1",
  "kor",
  "nwsl",
  "sud",
  "uel",
  "aut",
  "trsk",
  "col1",
  "den",
  "ja2",
  "cze1",
  "chi1",
  "gtm",
  "epl",
  "laliga",
  "bundesliga",
  "ligue-1",
  "sea",
  "arg",
  "uwcl",
  "svk1",
  "por",
  "spl",
  "ucol",
  "tennis",
  "atp",
  "wta",
  "itf",
  "atp-doubles",
  "wta-doubles",
  "cricket",
  "crint",
  "lpl",
  "crict20blast",
  "cricmlc",
  "cricshpageeza",
  "basketball",
  "wnba",
  "nbasl",
  "bkbsn",
  "nba",
  "baseball",
  "mlb",
  "kbo",
  "npb",
  "cpbl",
  "football",
  "cfl",
  "nfl",
  "cfb",
  "hockey",
  "volleyball",
  "golf",
  "combat",
  "ufc",
  "powerslap",
  "boxing",
  "motorsports",
  "f1",
  "indycar",
  "poker",
  "chess",
  "pickleball",
  "lacrosse",
  "pll",
  "wll",
  "cs2",
  "league-of-legends",
  "dota2",
  "valorant",
  "honor-of-kings",
  "call-of-duty",
  "mobile-legends-bang-bang",
  "rainbow-six-siege",
  "overwatch",
  "rocket-league",
  "starcraft-2",
  "starcraft-brood-war",
] as const;

describe("resolveSportsTaxonomyIcon", () => {
  it("resolves top-level sports and esports icons", () => {
    expect(resolveSportsTaxonomyIcon("soccer")).toBe(
      "/sports/taxonomy/soccer.svg",
    );
    expect(resolveSportsTaxonomyIcon("league_of_legends")).toBe(
      "/sports/taxonomy/league-of-legends.svg",
    );
    expect(resolveSportsTaxonomyIcon("mobile-legends-bang-bang")).toBe(
      "/sports/taxonomy/mobile-legends.jpg",
    );
  });

  it("resolves curated competitions and regional leagues", () => {
    expect(resolveSportsTaxonomyIcon("soccer-fifwc")).toBe(
      "/sports/taxonomy/world-cup.png",
    );
    expect(resolveSportsTaxonomyIcon("brazil-serie-a")).toBe(
      "/sports/taxonomy/countries/bra.png",
    );
    expect(resolveSportsTaxonomyIcon("csl")).toBe(
      "/sports/taxonomy/chinese-super-league.png",
    );
    expect(resolveSportsTaxonomyIcon("gtm")).toBe(
      "/sports/taxonomy/polymarket/gtm.svg",
    );
    expect(resolveSportsTaxonomyIcon("kor")).toBe(
      "/sports/taxonomy/polymarket/kor.svg",
    );
    expect(resolveSportsTaxonomyIcon("ja2")).toBe(
      "/sports/taxonomy/polymarket/ja2.svg",
    );
    expect(resolveSportsTaxonomyIcon("indycar")).toBe(
      "/sports/taxonomy/polymarket/indycar.svg",
    );
  });

  it("inherits the parent icon when no dedicated asset exists", () => {
    expect(
      resolveSportsTaxonomyIcon(
        "unknown-league",
        "/sports/taxonomy/soccer.svg",
      ),
    ).toBe("/sports/taxonomy/soccer.svg");
  });

  it("has an existing public asset for every current taxonomy slug", () => {
    for (const slug of CURRENT_TAXONOMY_SLUGS) {
      const icon = resolveSportsTaxonomyIcon(slug);
      expect(icon).toBeDefined();
      expect(existsSync(join(process.cwd(), "public", icon ?? ""))).toBe(true);
    }
  });
});
