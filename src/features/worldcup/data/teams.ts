import type { WcTeam } from "../types";

const BASE = "/worldcup/flags";

/** [code, English name, Chinese name, theme colour, flag filename]. */
const RAW: Array<[string, string, string, string, string]> = [
  ["ALG", "Algeria", "阿尔及利亚", "#107040", "alg.png"],
  ["ARG", "Argentina", "阿根廷", "#67A4DC", "arg.png"],
  ["AUS", "Australia", "澳大利亚", "#1946ae", "aus.png"],
  ["AUT", "Austria", "奥地利", "#bb1b36", "aut.png"],
  ["BEL", "Belgium", "比利时", "#e43f4a", "bel.png"],
  ["BIH", "Bosnia-Herzegovina", "波黑", "#1b42c0", "bih.png"],
  ["BRA", "Brazil", "巴西", "#128143", "bra.png"],
  ["CAN", "Canada", "加拿大", "#d62b1f", "can.png"],
  ["CDR", "DR Congo", "刚果民主共和国", "#2080df", "cdr.png"],
  ["CHE", "Switzerland", "瑞士", "#c02121", "che.png"],
  ["CIV", "Côte d'Ivoire", "科特迪瓦", "#e28736", "civ.png"],
  ["COL", "Colombia", "哥伦比亚", "#dfb920", "col.png"],
  ["CVI", "Cabo Verde", "佛得角", "#164a9c", "cvi.png"],
  ["CZE", "Czechia", "捷克", "#cd1d23", "cze.png"],
  ["ECU", "Ecuador", "厄瓜多尔", "#144e8f", "ecu.png"],
  ["EGY", "Egypt", "埃及", "#bb1b36", "egy.png"],
  ["ENG", "England", "英格兰", "#c41c2d", "eng.png"],
  ["ESP", "Spain", "西班牙", "#aa181d", "esp.png"],
  ["FRA", "France", "法国", "#144b8f", "fra.png"],
  ["GER", "Germany", "德国", "#c01b1b", "ger.png"],
  ["GHA", "Ghana", "加纳", "#b79a1a", "gha.png"],
  ["HAI", "Haiti", "海地", "#1d3fc9", "hai.png"],
  ["HRV", "Croatia", "克罗地亚", "#df2020", "hrv.png"],
  ["IRN", "IR Iran", "伊朗", "#239f40", "irn.png"],
  ["IRQ", "Iraq", "伊拉克", "#c41c2d", "irq.png"],
  ["JOR", "Jordan", "约旦", "#c41c30", "jor.png"],
  ["JPN", "Japan", "日本", "#a51839", "jpn.png"],
  ["KOR", "Curaçao", "库拉索", "#1847a5", "kor.png"],
  ["KR", "Korea Republic", "韩国", "#cc2e3b", "kr.png"],
  ["KSA", "Saudi Arabia", "沙特阿拉伯", "#10703e", "ksa.png"],
  ["MAR", "Morocco", "摩洛哥", "#be272c", "mar.png"],
  ["MEX", "Mexico", "墨西哥", "#107051", "mex.png"],
  ["NLD", "Netherlands", "荷兰", "#af1d29", "nld.png"],
  ["NOR", "Norway", "挪威", "#ae1937", "nor.png"],
  ["NZL", "New Zealand", "新西兰", "#1946ae", "nzl.png"],
  ["PAN", "Panama", "巴拿马", "#1849a5", "pan.png"],
  ["PAR", "Paraguay", "巴拉圭", "#d62b1f", "par.png"],
  ["PRT", "Portugal", "葡萄牙", "#df2020", "prt.png"],
  ["QAT", "Qatar", "卡塔尔", "#96173D", "qat.png"],
  ["RSA", "South Africa", "南非", "#10704b", "rsa.png"],
  ["SCO", "Scotland", "苏格兰", "#175ea1", "sco.png"],
  ["SEN", "Senegal", "塞内加尔", "#11733f", "sen.png"],
  ["SWE", "Sweden", "瑞典", "#124f81", "swe.png"],
  ["TUN", "Tunisia", "突尼斯", "#c91d2b", "tun.png"],
  ["TUR", "Türkiye", "土耳其", "#cd1d29", "tur.png"],
  ["URY", "Uruguay", "乌拉圭", "#1849aa", "ury.png"],
  ["USA", "United States", "美国", "#b31942", "usa.png"],
  ["UZB", "Uzbekistan", "乌兹别克斯坦", "#4484e4", "uzb.png"],
];

export const TEAMS: Record<string, WcTeam> = Object.fromEntries(
  RAW.map(([code, name, nameZh, color, flagFile]) => [
    code,
    { code, name, nameZh, color, flag: `${BASE}/${flagFile}` },
  ]),
);

/** Resolve a (possibly lowercase) team code to a team, or a grey placeholder. */
export function getTeam(code: string): WcTeam {
  const key = code.toUpperCase();
  return (
    TEAMS[key] ?? {
      code: key,
      name: code,
      nameZh: code,
      color: "#52525b",
      flag: "",
    }
  );
}

/**
 * Reverse index from English team name to {@link WcTeam}, used to resolve
 * backend prop candidate labels (which carry names, not codes) to a team so the
 * card can show its flag / Chinese name. Names are normalized to lowercase.
 * A few aliases bridge name mismatches between the upstream feed and `RAW`.
 */
const TEAM_BY_NAME: Record<string, WcTeam> = (() => {
  const index: Record<string, WcTeam> = {};
  for (const team of Object.values(TEAMS)) {
    index[team.name.toLowerCase()] = team;
  }
  const aliases: Array<[string, string]> = [
    ["south korea", "KR"],
    ["korea republic", "KR"],
    ["usa", "USA"],
    ["united states", "USA"],
    ["turkey", "TUR"],
    ["ivory coast", "CIV"],
    ["cape verde", "CVI"],
    ["bosnia and herzegovina", "BIH"],
    ["iran", "IRN"],
  ];
  for (const [name, code] of aliases) {
    const team = TEAMS[code];
    if (team) index[name] = team;
  }
  return index;
})();

/** Resolve an English team name (e.g. "France") to a team, if known. */
export function getTeamByName(name: string): WcTeam | undefined {
  return TEAM_BY_NAME[name.trim().toLowerCase()];
}
