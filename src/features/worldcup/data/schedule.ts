/**
 * 2026 FIFA World Cup match schedule, transcribed from the canonical
 * future.news + balldontlie dataset (`.plans/worldcup/future.news/data/match-schedule.csv`).
 * Group matches carry real Polymarket slugs and 24h volume; knockout matches
 * carry the bracket placeholders, venue and kickoff.
 */

/** [matchId, group, homeCode, awayCode, kickoffMs, slug, volumeUsd]. */
export const GROUP_MATCHES: Array<
  [string, string, string, string, number, string, number]
> = [
  ["M1", "A", "mex", "rsa", 1781204400000, "fifwc-mex-rsa-2026-06-11", 110307],
  ["M2", "A", "kr", "cze", 1781229600000, "fifwc-kr-cze-2026-06-11", 19983],
  ["M3", "B", "can", "bih", 1781290800000, "fifwc-can-bih-2026-06-12", 31409],
  ["M4", "D", "usa", "par", 1781312400000, "fifwc-usa-par-2026-06-12", 86503],
  ["M5", "B", "qat", "che", 1781377200000, "fifwc-qat-che-2026-06-13", 24376],
  ["M6", "C", "bra", "mar", 1781388000000, "fifwc-bra-mar-2026-06-13", 37826],
  ["M7", "C", "hai", "sco", 1781398800000, "fifwc-hai-sco-2026-06-13", 19765],
  ["M8", "D", "aus", "tur", 1781409600000, "fifwc-aus-tur-2026-06-14", 8931],
  ["M9", "E", "ger", "kor", 1781456400000, "fifwc-ger-kor-2026-06-14", 71186],
  ["M10", "F", "nld", "jpn", 1781467200000, "fifwc-nld-jpn-2026-06-14", 39053],
  ["M11", "E", "civ", "ecu", 1781478000000, "fifwc-civ-ecu-2026-06-14", 12744],
  ["M12", "F", "swe", "tun", 1781488800000, "fifwc-swe-tun-2026-06-14", 2911],
  ["M13", "H", "esp", "cvi", 1781539200000, "fifwc-esp-cvi-2026-06-15", 50723],
  ["M14", "G", "bel", "egy", 1781550000000, "fifwc-bel-egy-2026-06-15", 4385],
  ["M15", "H", "ksa", "ury", 1781560800000, "fifwc-ksa-ury-2026-06-15", 7812],
  ["M16", "G", "irn", "nzl", 1781571600000, "fifwc-irn-nzl-2026-06-15", 16537],
  ["M17", "I", "fra", "sen", 1781636400000, "fifwc-fra-sen-2026-06-16", 18176],
  ["M18", "I", "irq", "nor", 1781647200000, "fifwc-irq-nor-2026-06-16", 11718],
  ["M19", "J", "arg", "alg", 1781658000000, "fifwc-arg-alg-2026-06-16", 24782],
  ["M20", "J", "aut", "jor", 1781668800000, "fifwc-aut-jor-2026-06-17", 4789],
  ["M21", "K", "prt", "cdr", 1781715600000, "fifwc-prt-cdr-2026-06-17", 20305],
  ["M22", "L", "eng", "hrv", 1781726400000, "fifwc-eng-hrv-2026-06-17", 12145],
  ["M23", "L", "gha", "pan", 1781737200000, "fifwc-gha-pan-2026-06-17", 5792],
  ["M24", "K", "uzb", "col", 1781748000000, "fifwc-uzb-col-2026-06-17", 8365],
  ["M25", "A", "cze", "rsa", 1781798400000, "fifwc-cze-rsa-2026-06-18", 1982],
  ["M26", "B", "che", "bih", 1781809200000, "fifwc-che-bih-2026-06-18", 2657],
  ["M27", "B", "can", "qat", 1781820000000, "fifwc-can-qat-2026-06-18", 7294],
  ["M28", "A", "mex", "kr", 1781830800000, "fifwc-mex-kr-2026-06-18", 2449],
  ["M29", "D", "usa", "aus", 1781895600000, "fifwc-usa-aus-2026-06-19", 4445],
  ["M30", "C", "sco", "mar", 1781906400000, "fifwc-sco-mar-2026-06-19", 3540],
  ["M31", "C", "bra", "hai", 1781915400000, "fifwc-bra-hai-2026-06-19", 21261],
  ["M32", "D", "tur", "par", 1781924400000, "fifwc-tur-par-2026-06-19", 1521],
  ["M33", "F", "nld", "swe", 1781974800000, "fifwc-nld-swe-2026-06-20", 2569],
  ["M34", "E", "ger", "civ", 1781985600000, "fifwc-ger-civ-2026-06-20", 5790],
  ["M35", "E", "ecu", "kor", 1782000000000, "fifwc-ecu-kor-2026-06-20", 22129],
  ["M36", "F", "tun", "jpn", 1782014400000, "fifwc-tun-jpn-2026-06-21", 2073],
  ["M37", "H", "esp", "ksa", 1782057600000, "fifwc-esp-ksa-2026-06-21", 5626],
  ["M38", "G", "bel", "irn", 1782068400000, "fifwc-bel-irn-2026-06-21", 1776],
  ["M39", "H", "ury", "cvi", 1782079200000, "fifwc-ury-cvi-2026-06-21", 1806],
  ["M40", "G", "nzl", "egy", 1782090000000, "fifwc-nzl-egy-2026-06-21", 1148],
  ["M41", "J", "arg", "aut", 1782147600000, "fifwc-arg-aut-2026-06-22", 3516],
  ["M42", "I", "fra", "irq", 1782162000000, "fifwc-fra-irq-2026-06-22", 6578],
  ["M43", "I", "nor", "sen", 1782172800000, "fifwc-nor-sen-2026-06-22", 5299],
  ["M44", "J", "jor", "alg", 1782183600000, "fifwc-jor-alg-2026-06-22", 1028],
  ["M45", "K", "prt", "uzb", 1782234000000, "fifwc-prt-uzb-2026-06-23", 4311],
  ["M46", "L", "eng", "gha", 1782244800000, "fifwc-eng-gha-2026-06-23", 3099],
  ["M47", "L", "pan", "hrv", 1782255600000, "fifwc-pan-hrv-2026-06-23", 2359],
  ["M48", "K", "col", "cdr", 1782266400000, "fifwc-col-cdr-2026-06-23", 1803],
  ["M49", "B", "bih", "qat", 1782327600000, "fifwc-bih-qat-2026-06-24", 1179],
  ["M50", "B", "che", "can", 1782327600000, "fifwc-che-can-2026-06-24", 609],
  ["M51", "C", "mar", "hai", 1782338400000, "fifwc-mar-hai-2026-06-24", 921],
  ["M52", "C", "sco", "bra", 1782338400000, "fifwc-sco-bra-2026-06-24", 1625],
  ["M53", "A", "cze", "mex", 1782349200000, "fifwc-cze-mex-2026-06-24", 2866],
  ["M54", "A", "rsa", "kr", 1782349200000, "fifwc-rsa-kr-2026-06-24", 518],
  ["M55", "E", "ecu", "ger", 1782417600000, "fifwc-ecu-ger-2026-06-25", 3138],
  ["M56", "E", "kor", "civ", 1782417600000, "fifwc-kor-civ-2026-06-25", 423],
  ["M57", "F", "jpn", "swe", 1782428400000, "fifwc-jpn-swe-2026-06-25", 887],
  ["M58", "F", "tun", "nld", 1782428400000, "fifwc-tun-nld-2026-06-25", 2901],
  ["M59", "D", "par", "aus", 1782439200000, "fifwc-par-aus-2026-06-25", 394],
  ["M60", "D", "tur", "usa", 1782439200000, "fifwc-tur-usa-2026-06-25", 2501],
  ["M61", "I", "nor", "fra", 1782500400000, "fifwc-nor-fra-2026-06-26", 1554],
  ["M62", "I", "sen", "irq", 1782500400000, "fifwc-sen-irq-2026-06-26", 642],
  ["M63", "H", "cvi", "ksa", 1782518400000, "fifwc-cvi-ksa-2026-06-26", 428],
  ["M64", "H", "ury", "esp", 1782518400000, "fifwc-ury-esp-2026-06-26", 1474],
  ["M65", "G", "egy", "irn", 1782529200000, "fifwc-egy-irn-2026-06-26", 369],
  ["M66", "G", "nzl", "bel", 1782529200000, "fifwc-nzl-bel-2026-06-26", 1621],
  ["M67", "L", "hrv", "gha", 1782594000000, "fifwc-hrv-gha-2026-06-27", 585],
  ["M68", "L", "pan", "eng", 1782594000000, "fifwc-pan-eng-2026-06-27", 2392],
  ["M69", "K", "cdr", "uzb", 1782603000000, "fifwc-cdr-uzb-2026-06-27", 316],
  ["M70", "K", "col", "prt", 1782603000000, "fifwc-col-prt-2026-06-27", 1616],
  ["M71", "J", "alg", "aut", 1782612000000, "fifwc-alg-aut-2026-06-27", 443],
  ["M72", "J", "jor", "arg", 1782612000000, "fifwc-jor-arg-2026-06-27", 3938],
];

/** [matchId, Polymarket slug] for resolved knockout fixtures. */
export const KNOCKOUT_MATCH_SLUGS: Array<[string, string]> = [
  ["M73", "fifwc-rsa-can-2026-06-28"],
  ["M74", "fifwc-ger-par-2026-06-29"],
  ["M75", "fifwc-nld-mar-2026-06-29"],
  ["M76", "fifwc-bra-jpn-2026-06-29"],
  ["M77", "fifwc-fra-swe-2026-06-30"],
  ["M78", "fifwc-civ-nor-2026-06-30"],
  ["M79", "fifwc-mex-ecu-2026-06-30"],
  ["M80", "fifwc-eng-cdr-2026-07-01"],
  ["M81", "fifwc-usa-bih-2026-07-01"],
  ["M82", "fifwc-bel-sen-2026-07-01"],
  ["M83", "fifwc-prt-hrv-2026-07-02"],
  ["M84", "fifwc-esp-aut-2026-07-02"],
  ["M85", "fifwc-che-alg-2026-07-02"],
  ["M86", "fifwc-arg-cvi-2026-07-03"],
  ["M87", "fifwc-col-gha-2026-07-03"],
  ["M88", "fifwc-aus-egy-2026-07-03"],
  ["M89", "fifwc-can-mar-2026-07-04"],
  ["M90", "fifwc-par-fra-2026-07-04"],
  ["M91", "fifwc-bra-nor-2026-07-05"],
  ["M92", "fifwc-mex-eng-2026-07-05"],
  ["M93", "fifwc-prt-esp-2026-07-06"],
  ["M94", "fifwc-usa-bel-2026-07-06"],
  ["M95", "fifwc-arg-egy-2026-07-07"],
  ["M96", "fifwc-che-col-2026-07-07"],
  ["M97", "fifwc-fra-mar-2026-07-09"],
  ["M98", "fifwc-esp-bel-2026-07-10"],
  ["M99", "fifwc-nor-eng-2026-07-11"],
  ["M100", "fifwc-arg-che-2026-07-11"],
  ["M101", "fifwc-fra-esp-2026-07-14"],
  ["M102", "fifwc-eng-arg-2026-07-15"],
  ["M103", "fifwc-fra-eng-2026-07-18"],
  ["M104", "fifwc-esp-arg-2026-07-19"],
];

/**
 * Static `matchId → Polymarket slug` map for resolved World Cup fixtures.
 * Lets launch redirects and detail routing resolve match links with zero
 * network. Knockout entries are appended as their fixtures become known.
 */
export const MATCH_SLUG_BY_ID: Record<string, string> = Object.fromEntries(
  [
    ...GROUP_MATCHES.map(([matchId, , , , , slug]) => [matchId, slug] as const),
    ...KNOCKOUT_MATCH_SLUGS,
  ],
);

export const WORLD_CUP_MATCH_SLUGS = new Set(
  [
    ...GROUP_MATCHES.map(([, , , , , slug]) => slug),
    ...KNOCKOUT_MATCH_SLUGS.map(([, slug]) => slug),
  ],
);

/** Resolve a matchId to its detail slug from the static schedule, or null. */
export function matchSlugById(matchId: string): string | null {
  return MATCH_SLUG_BY_ID[matchId] ?? null;
}

/** Resolve a group-stage match or child event slug to the owning match slug. */
export function worldcupMatchSlugFromEventSlug(slug: string): string | null {
  if (WORLD_CUP_MATCH_SLUGS.has(slug)) return slug;

  // Current child event slugs are prefixed by the canonical match slug, e.g.
  // `fifwc-mex-rsa-2026-06-11-total-corners`.
  for (const matchSlug of WORLD_CUP_MATCH_SLUGS) {
    if (slug.startsWith(`${matchSlug}-`)) return matchSlug;
  }
  return null;
}

/** [matchId, round, homeLabel, awayLabel, kickoffMs, venue, city]. */
export const KNOCKOUT_MATCHES: Array<
  [string, string, string, string, number, string, string]
> = [
  ["M73", "r32", "2A", "2B", 1782673200000, "Los Angeles Stadium", "Los Angeles"],
  ["M74", "r32", "1E", "3ABCDF", 1782765000000, "Boston Stadium", "Boston"],
  ["M75", "r32", "1F", "2C", 1782781200000, "Monterrey Stadium", "Monterrey"],
  ["M76", "r32", "1C", "2F", 1782752400000, "Houston Stadium", "Houston"],
  ["M77", "r32", "1I", "3CDFGH", 1782853200000, "New York/New Jersey Stadium", "New York"],
  ["M78", "r32", "2E", "2I", 1782838800000, "Dallas Stadium", "Dallas"],
  ["M79", "r32", "1A", "3CEFHI", 1782867600000, "Mexico City Stadium", "Mexico City"],
  ["M80", "r32", "1L", "3EHIJK", 1782921600000, "Atlanta Stadium", "Atlanta"],
  ["M81", "r32", "1D", "3BEFIJ", 1782950400000, "San Francisco Bay Area Stadium", "San Francisco Bay Area"],
  ["M82", "r32", "1G", "3AEHIJ", 1782936000000, "Seattle Stadium", "Seattle"],
  ["M83", "r32", "2K", "2L", 1783033200000, "Toronto Stadium", "Toronto"],
  ["M84", "r32", "1H", "2J", 1783018800000, "Los Angeles Stadium", "Los Angeles"],
  ["M85", "r32", "1B", "3EFGIJ", 1783047600000, "BC Place Vancouver", "Vancouver"],
  ["M86", "r32", "1J", "2H", 1783116000000, "Miami Stadium", "Miami"],
  ["M87", "r32", "1K", "3DEIJL", 1783128600000, "Kansas City Stadium", "Kansas City"],
  ["M88", "r32", "2D", "2G", 1783101600000, "Dallas Stadium", "Dallas"],
  ["M89", "r16", "W73", "W75", 1783184400000, "Houston Stadium", "Houston"],
  ["M90", "r16", "W74", "W77", 1783198800000, "Philadelphia Stadium", "Philadelphia"],
  ["M91", "r16", "W76", "W78", 1783281600000, "New York/New Jersey Stadium", "New York"],
  ["M92", "r16", "W79", "W80", 1783296000000, "Mexico City Stadium", "Mexico City"],
  ["M93", "r16", "W83", "W84", 1783364400000, "Dallas Stadium", "Dallas"],
  ["M94", "r16", "W81", "W82", 1783382400000, "Seattle Stadium", "Seattle"],
  ["M95", "r16", "W86", "W88", 1783440000000, "Atlanta Stadium", "Atlanta"],
  ["M96", "r16", "W85", "W87", 1783454400000, "BC Place Vancouver", "Vancouver"],
  ["M97", "r8", "France", "Morocco", 1783627200000, "Gillette Stadium", "Foxborough"],
  ["M98", "r8", "Spain", "Belgium", 1783710000000, "SoFi Stadium", "Inglewood"],
  ["M99", "r8", "Norway", "England", 1783803600000, "Hard Rock Stadium", "Miami Gardens"],
  ["M100", "r8", "Argentina", "Switzerland", 1783818000000, "Arrowhead Stadium", "Kansas City"],
  ["M101", "r4", "France", "Spain", 1784055600000, "Dallas Stadium", "Dallas"],
  ["M102", "r4", "England", "Argentina", 1784142000000, "Atlanta Stadium", "Atlanta"],
  ["M103", "r3rd", "France", "England", 1784408400000, "Hard Rock Stadium", "Miami Gardens"],
  ["M104", "final", "Spain", "Argentina", 1784487600000, "MetLife Stadium", "East Rutherford"],
];

/**
 * Per-match TheSports live-widget id (the `uuid` in the embed URL), keyed by
 * `matchId`. Captured from `/api/v1/worldcup/matches` (field `thesportsMatchId`);
 * full mapping in `.plans/worldcup/future.news/data/thesports-match-widgets.csv`.
 */
export const THESPORTS_MATCH_IDS: Record<string, string> = {
  M1: "4wyrn4h6ly13q86",
  M2: "6ypq3nhvnppnmd7",
  M3: "dj2ryohlx70vq1z",
  M4: "6ypq3nhvnkozmd7",
  M5: "vjxm8ghew77er6o",
  M6: "l7oqdehg39x1r51",
  M7: "n54qllhnzwwwqvy",
  M8: "1l4rjnh9lddom7v",
  M9: "6ypq3nhvnp8nmd7",
  M10: "vjxm8ghew70er6o",
  M11: "965mkyhko00jr1g",
  M12: "318q66hxg3doqo9",
  M13: "1l4rjnh9ldgom7v",
  M14: "n54qllhnzw3wqvy",
  M15: "dj2ryohlx93dq1z",
  M16: "l5ergph487jer8k",
  M17: "965mkyhko0wjr1g",
  M18: "y0or5jh8owd5qwz",
  M19: "318q66hxg33oqo9",
  M20: "vjxm8ghew7o6r6o",
  M21: "l5ergph4877er8k",
  M22: "dj2ryohlx99dq1z",
  M23: "1l4rjnh9ld0ym7v",
  M24: "n54qllhnzwyoqvy",
  M25: "pxwrxlhy300xryk",
  M26: "x7lm7phj722xm2w",
  M27: "2y8m4zh5pv93ql0",
  M28: "l5ergph48kj9r8k",
  M29: "pxwrxlhy3lojryk",
  M30: "23xmvkh60llzqg8",
  M31: "dj2ryohlx9pdq1z",
  M32: "4jwq2ghn9552m0v",
  M33: "x7lm7phj72vxm2w",
  M34: "pxwrxlhy30nxryk",
  M35: "y39mp1h64ee7moj",
  M36: "dn1m1ghl0gdemoe",
  M37: "4jwq2ghn95w2m0v",
  M38: "23xmvkh60l2zqg8",
  M39: "vjxm8ghew7oer6o",
  M40: "jw2r09hk0gdwrz8",
  M41: "dn1m1ghl0ggemoe",
  M42: "y39mp1h64eo7moj",
  M43: "pxwrxlhy30w0ryk",
  M44: "x7lm7phj72dym2w",
  M45: "jw2r09hk0ggwrz8",
  M46: "2y8m4zh5peenql0",
  M47: "4jwq2ghn95j4m0v",
  M48: "23xmvkh60lzeqg8",
  M49: "y0or5jh8oww5qwz",
  M50: "8yomo4h14yokq0j",
  M51: "zp5rzghgwdd9q82",
  M52: "2y8m4zh5pe7nql0",
  M53: "l7oqdehg3jz7r51",
  M54: "3glrw7hnpgg7qdy",
  M55: "3glrw7hnpg97qdy",
  M56: "k82rekhgxjdzrep",
  M57: "4wyrn4h6l51dq86",
  M58: "y0or5jh8ow55qwz",
  M59: "ednm9whw0pp3ryo",
  M60: "3glrw7hnp45zqdy",
  M61: "k82rekhgxjjzrep",
  M62: "3glrw7hnpgeeqdy",
  M63: "x7lm7phj72dxm2w",
  M64: "ednm9whw0po3ryo",
  M65: "l7oqdehg39z1r51",
  M66: "zp5rzghgwdo9q82",
  M67: "ednm9whw0p49ryo",
  M68: "8yomo4h1466xq0j",
  M69: "zp5rzghgwde8q82",
  M70: "l7oqdehg3991r51",
  M71: "y0or5jh8owdpqwz",
  M72: "4wyrn4h6l55dq86",
};

/** Group membership in official standings order (rank 1→4), from the BFF. */
export const GROUP_ORDER: Record<string, string[]> = {
  A: ["mex", "rsa", "kr", "cze"],
  B: ["can", "bih", "qat", "che"],
  C: ["bra", "mar", "hai", "sco"],
  D: ["usa", "par", "aus", "tur"],
  E: ["ger", "kor", "civ", "ecu"],
  F: ["nld", "jpn", "swe", "tun"],
  G: ["bel", "egy", "irn", "nzl"],
  H: ["esp", "cvi", "ksa", "ury"],
  I: ["fra", "sen", "irq", "nor"],
  J: ["arg", "alg", "aut", "jor"],
  K: ["prt", "cdr", "uzb", "col"],
  L: ["eng", "hrv", "gha", "pan"],
};
