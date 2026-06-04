/**
 * World Cup prop / futures events, transcribed from `.plans/worldcup/canonical/props.csv`.
 * Outcome previews are SYNTHESIZED for the static preview (see odds-synth):
 * team-based props use a strength softmax; player / continent props use a
 * fixed mock ranking. NOT real market data.
 */

import type { WcOutcome, WcProp } from "../types";
import { TEAMS } from "./teams";
import { teamStrength } from "./odds-synth";

/** [slug, titleEn, titleZh, volumeUsd, marketCount]. */
const RAW: Array<[string, string, string, number, number]> = [
  ["world-cup-winner", "World Cup Winner", "世界杯冠军", 1480640089, 60],
  ["world-cup-top-goalscorer", "World Cup: Top Goalscorer", "世界杯：最佳射手", 1298696, 80],
  ["which-continent-will-win-the-world-cup", "Which continent will win the World Cup?", "哪个大洲将赢得世界杯？", 2792492, 7],
  ["will-neymar-play-in-the-world-cup", "Will Neymar play in the World Cup?", "内马尔会参加世界杯吗？", 2681803, 1],
  ["will-lionel-messi-play-in-the-world-cup", "Will Lionel Messi play in the World Cup?", "莱昂内尔·梅西会参加世界杯吗？", 205763, 1],
  ["will-iran-play-in-the-world-cup", "Will Iran play in the World Cup?", "伊朗会参加世界杯吗？", 274312, 1],
  ["world-cup-team-to-advance-to-knockout-stages", "Team to advance to Knockout Stages", "球队晋级淘汰赛阶段", 179963, 48],
  ["world-cup-nation-to-reach-final", "Nation to Reach Final", "进入决赛的国家", 111870, 48],
  ["world-cup-nation-to-reach-semifinals", "Nation To Reach Semifinals", "国家进入半决赛", 9907, 48],
  ["world-cup-nation-to-reach-quarterfinals", "Nation To Reach Quarterfinals", "国家进入四分之一决赛", 13698, 48],
  ["world-cup-nation-to-reach-round-of-16", "Nation To Reach Round of 16", "国家达到 16 强", 41711, 48],
  ["world-cup-player-to-score", "Player to score", "球员得分", 176359, 155],
  ["world-cup-player-to-make-brazil-squad", "Player to make Brazil Squad", "球员入选巴西队", 370461, 35],
  ["world-cup-nation-of-top-goalscorer", "Nation of Top Goalscorer", "最佳射手的国家", 41438, 54],
  ["world-cup-top-scorer-nation", "Top Scorer (Nation)", "最佳射手（国家）", 71542, 54],
  ["world-cup-most-assists", "Most Assists", "助攻最多", 8019, 109],
  ["world-cup-most-goal-contributions", "Most Goal Contributions", "最多进球贡献", 10107, 109],
  ["world-cup-most-clean-sheets-gk", "Most Clean Sheets (GK)", "最多零封（门将）", 7747, 109],
  ["world-cup-unbeaten-champion", "Unbeaten Champion?", "不败冠军？", 115713, 1],
  ["2026-fifa-world-cup-winless-team", "Winless Team?", "无胜队？", 12272, 1],
  ["world-cup-group-a-winner", "Group A Winner", "A 组冠军", 369600, 5],
  ["world-cup-group-b-winner", "Group B Winner", "B 组冠军", 169206, 5],
  ["world-cup-group-c-winner", "Group C Winner", "C 组冠军", 370309, 5],
  ["world-cup-group-d-winner", "Group D Winner", "D 组冠军", 116893, 5],
  ["world-cup-group-e-winner", "Group E Winner", "E 组冠军", 82885, 5],
  ["world-cup-group-f-winner", "Group F Winner", "F 组冠军", 216866, 5],
  ["world-cup-group-g-winner", "Group G Winner", "G 组冠军", 97078, 5],
  ["world-cup-group-h-winner", "Group H Winner", "H 组冠军", 210972, 5],
  ["world-cup-group-i-winner", "Group I Winner", "I 组冠军", 222063, 5],
  ["world-cup-group-j-winner", "Group J Winner", "J 组冠军", 161943, 5],
  ["world-cup-group-k-winner", "Group K Winner", "K 组冠军", 108688, 5],
  ["world-cup-group-l-winner", "Group L Winner", "L 组冠军", 73680, 5],
];

import { GROUP_ORDER } from "./schedule";

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Softmax probabilities over team strengths (temperature controls spread). */
function teamSoftmax(codes: string[], temperature: number): WcOutcome[] {
  const exps = codes.map((c) => Math.exp(teamStrength(c) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return codes
    .map((c, i) => {
      const t = TEAMS[c.toUpperCase()];
      return {
        label: t?.name ?? c.toUpperCase(),
        labelZh: t?.nameZh,
        teamCode: c,
        price: round2(exps[i] / sum),
      };
    })
    .sort((a, b) => b.price - a.price);
}

const TOP_TEAMS = ["ESP", "BRA", "FRA", "ARG", "ENG", "GER", "PRT", "NLD", "URY", "HRV", "BEL", "MAR"];

const PLAYER_RANKING: Array<[string, string, string]> = [
  ["Kylian Mbappé", "姆巴佩", "FRA"],
  ["Erling Haaland", "哈兰德", "NOR"],
  ["Lamine Yamal", "亚马尔", "ESP"],
  ["Vinícius Jr", "维尼修斯", "BRA"],
  ["Harry Kane", "凯恩", "ENG"],
  ["Julián Álvarez", "阿尔瓦雷斯", "ARG"],
  ["Jude Bellingham", "贝林厄姆", "ENG"],
  ["Pedri", "佩德里", "ESP"],
];

const CONTINENTS: Array<[string, string, number]> = [
  ["Europe", "欧洲", 0.56],
  ["South America", "南美洲", 0.33],
  ["North America", "北美洲", 0.06],
  ["Africa", "非洲", 0.04],
  ["Asia", "亚洲", 0.01],
];

function players(seed: number): WcOutcome[] {
  const p = 0.14;
  return PLAYER_RANKING.map(([label, labelZh, code], i) => {
    const price = round2(Math.max(0.02, p - i * 0.012 + ((seed % 5) - 2) * 0.002));
    return { label, labelZh, teamCode: code, price };
  });
}

function binaryYes(prob: number): WcOutcome[] {
  return [
    { label: "Yes", labelZh: "是", price: round2(prob) },
    { label: "No", labelZh: "否", price: round2(1 - prob) },
  ];
}

function buildOutcomes(slug: string): WcOutcome[] {
  const groupMatch = slug.match(/group-([a-l])-winner/);
  if (groupMatch) {
    const g = groupMatch[1].toUpperCase();
    return teamSoftmax(GROUP_ORDER[g] ?? [], 9).slice(0, 4);
  }
  if (slug === "world-cup-winner") return teamSoftmax(TOP_TEAMS, 9).slice(0, 6);
  if (slug === "which-continent-will-win-the-world-cup")
    return CONTINENTS.map(([label, labelZh, price]) => ({ label, labelZh, price }));
  if (slug.startsWith("will-")) {
    if (slug.includes("messi")) return binaryYes(0.42);
    if (slug.includes("neymar")) return binaryYes(0.58);
    if (slug.includes("iran")) return binaryYes(0.86);
    return binaryYes(0.7);
  }
  if (slug.includes("unbeaten")) return binaryYes(0.18);
  if (slug.includes("winless")) return binaryYes(0.31);
  if (
    slug.includes("goalscorer") ||
    slug.includes("player-to-score") ||
    slug.includes("most-assists") ||
    slug.includes("goal-contributions") ||
    slug.includes("clean-sheets") ||
    slug.includes("brazil-squad")
  ) {
    return players(slug.length);
  }
  // nation-to-reach-* / advance / top-scorer-nation → top teams.
  return teamSoftmax(TOP_TEAMS, 11).slice(0, 6);
}

export function buildProps(): WcProp[] {
  return RAW.map(([slug, titleEn, titleZh, volume, marketCount]) => ({
    slug,
    titleEn,
    titleZh,
    volume,
    marketCount,
    outcomes: buildOutcomes(slug),
  }));
}
