import type { WcTeam } from "../types";

const BASE = "https://polymarket-upload.s3.us-east-2.amazonaws.com";

/** [code, English name, Chinese name, theme colour, flag filename]. */
const RAW: Array<[string, string, string, string, string]> = [
  ["ALG", "Algeria", "阿尔及利亚", "#107040", "Algeria-a098432aa7.png"],
  ["ARG", "Argentina", "阿根廷", "#67A4DC", "Argentina-182153c3dd.png"],
  ["AUS", "Australia", "澳大利亚", "#1946ae", "Australia-c124bed048.png"],
  ["AUT", "Austria", "奥地利", "#bb1b36", "Austria-8ee4b01a98.png"],
  ["BEL", "Belgium", "比利时", "#e43f4a", "Belgium-f5040430dd.png"],
  ["BIH", "Bosnia-Herzegovina", "波黑", "#1b42c0", "Bosnia-Herzegovina-868e929209.png"],
  ["BRA", "Brazil", "巴西", "#128143", "Brazil-7b26872c5b.png"],
  ["CAN", "Canada", "加拿大", "#d62b1f", "Canada-529c24bcfb.png"],
  ["CDR", "DR Congo", "刚果民主共和国", "#2080df", "DR Congo-0a32eb7bfe.png"],
  ["CHE", "Switzerland", "瑞士", "#c02121", "Switzerland-eb3b9b5167.png"],
  ["CIV", "Côte d'Ivoire", "科特迪瓦", "#e28736", "Côte d'Ivoire-829fa69150.png"],
  ["COL", "Colombia", "哥伦比亚", "#dfb920", "Colombia-096627d8a2.png"],
  ["CVI", "Cabo Verde", "佛得角", "#164a9c", "Cabo Verde-6a0b5592c4.png"],
  ["CZE", "Czechia", "捷克", "#cd1d23", "Czechia-973246d97a.png"],
  ["ECU", "Ecuador", "厄瓜多尔", "#144e8f", "Ecuador-9b4af94758.png"],
  ["EGY", "Egypt", "埃及", "#bb1b36", "Egypt-25dade1183.png"],
  ["ENG", "England", "英格兰", "#c41c2d", "England-51e34db93c.png"],
  ["ESP", "Spain", "西班牙", "#aa181d", "Spain-7fd7fb20f3.png"],
  ["FRA", "France", "法国", "#144b8f", "France-e9affbd5a2.png"],
  ["GER", "Germany", "德国", "#c01b1b", "Germany-63cabc9f60.png"],
  ["GHA", "Ghana", "加纳", "#b79a1a", "Ghana-5e8015fb06.png"],
  ["HAI", "Haiti", "海地", "#1d3fc9", "Haiti-4d762c9160.png"],
  ["HRV", "Croatia", "克罗地亚", "#df2020", "Croatia-5975b6a3b2.png"],
  ["IRN", "IR Iran", "伊朗", "#239f40", "IR Iran-d087f60b44.png"],
  ["IRQ", "Iraq", "伊拉克", "#c41c2d", "Iraq-c7b83c3016.png"],
  ["JOR", "Jordan", "约旦", "#c41c30", "Jordan-1a560c81b8.png"],
  ["JPN", "Japan", "日本", "#a51839", "Japan-da1d5dae13.png"],
  ["KOR", "Curaçao", "库拉索", "#1847a5", "Curaçao-3b1e3eecd4.png"],
  ["KR", "Korea Republic", "韩国", "#cc2e3b", "Korea Republic-de7776cb88.png"],
  ["KSA", "Saudi Arabia", "沙特阿拉伯", "#10703e", "Saudi Arabia-591a9a0aa9.png"],
  ["MAR", "Morocco", "摩洛哥", "#be272c", "Morocco-8a84f8e56c.png"],
  ["MEX", "Mexico", "墨西哥", "#107051", "Mexico-dca6a00b6d.png"],
  ["NLD", "Netherlands", "荷兰", "#af1d29", "Netherlands-5990c81d39.png"],
  ["NOR", "Norway", "挪威", "#ae1937", "Norway-b87bd7e0b5.png"],
  ["NZL", "New Zealand", "新西兰", "#1946ae", "New Zealand-f5e4e9e65c.png"],
  ["PAN", "Panama", "巴拿马", "#1849a5", "Panama-796125f96f.png"],
  ["PAR", "Paraguay", "巴拉圭", "#d62b1f", "Paraguay-df8ca4e644.png"],
  ["PRT", "Portugal", "葡萄牙", "#df2020", "Portugal-e594da7f36.png"],
  ["QAT", "Qatar", "卡塔尔", "#96173D", "Qatar-dcf5549892.png"],
  ["RSA", "South Africa", "南非", "#10704b", "South Africa-9dd4f78e33.png"],
  ["SCO", "Scotland", "苏格兰", "#175ea1", "Scotland-75425c8075.png"],
  ["SEN", "Senegal", "塞内加尔", "#11733f", "Senegal-ad12355764.png"],
  ["SWE", "Sweden", "瑞典", "#124f81", "Sweden-8f153dea44.png"],
  ["TUN", "Tunisia", "突尼斯", "#c91d2b", "Tunisia-ec80d55fec.png"],
  ["TUR", "Türkiye", "土耳其", "#cd1d29", "Türkiye-e55f684d53.png"],
  ["URY", "Uruguay", "乌拉圭", "#1849aa", "Uruguay-fa69ff8aeb.png"],
  ["USA", "United States", "美国", "#b31942", "United States-c25fb90a8b.png"],
  ["UZB", "Uzbekistan", "乌兹别克斯坦", "#4484e4", "Uzbekistan-dd15744497.png"],
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
