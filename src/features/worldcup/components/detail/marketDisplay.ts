import type { PredictMarket } from "@liberfi.io/react-predict";
import type { WorldCupTranslate } from "../../display";
import { formatLine } from "../../odds/convert-price";
import {
  marketLine,
  periodMarketLabel,
  type MarketGroup,
  type MarketOption,
  type SportsMarketType,
  type TeamHint,
} from "./marketGrouping";

const OPTION_ONLY_SURFACE_LABEL_TYPES = new Set<SportsMarketType>([
  "soccer_player_goals",
  "soccer_player_goals_plus_assists",
  "soccer_player_goalkeeper_saves",
  "soccer_player_assists",
  "soccer_player_shots",
  "soccer_player_shots_on_target",
]);

function isMoneylineGroup(group: { type: SportsMarketType }): boolean {
  return (
    group.type === "moneyline" ||
    group.type === "soccer_match_winner" ||
    group.type === "soccer_halftime_result" ||
    group.type === "soccer_second_half_result"
  );
}

function isBothTeamsToScoreGroup(group: { type: SportsMarketType }): boolean {
  return (
    group.type === "both_teams_to_score" ||
    group.type === "both_teams_to_score_first_half" ||
    group.type === "both_teams_to_score_second_half"
  );
}

function isTotalGoalsGroup(group: { type: SportsMarketType }): boolean {
  return (
    group.type === "totals" ||
    group.type === "first_half_totals" ||
    group.type === "second_half_totals"
  );
}

function isTeamTotalGoalsGroup(group: { type: SportsMarketType }): boolean {
  return (
    group.type === "soccer_team_totals" ||
    group.type === "soccer_first_half_team_totals" ||
    group.type === "soccer_second_half_team_totals"
  );
}

function isCornerTotalGroup(group: { type: SportsMarketType }): boolean {
  return (
    group.type === "soccer_second_half_total_corners" ||
    group.type === "total_corners" ||
    group.type === "soccer_first_half_total_corners"
  );
}

function isTeamTotalCornersGroup(group: { type: SportsMarketType }): boolean {
  return group.type === "soccer_team_total_corners";
}

function isCornerOddEvenGroup(group: { type: SportsMarketType }): boolean {
  return group.type === "soccer_game_corners_odd_even";
}

function marketMetaString(market: PredictMarket, key: string): string {
  const value = market.provider_meta?.[key];
  return typeof value === "string" ? value : "";
}

function textMatchesAny(text: string, keys: Set<string>): boolean {
  const lower = text.toLowerCase();
  for (const key of keys) {
    if (key && lower.includes(key)) return true;
  }
  return false;
}

function bothTeamsToScoreLabel(
  type: SportsMarketType,
  hint: TeamHint | undefined,
  t: WorldCupTranslate,
): string {
  return periodMarketLabel(type, t("extend.worldcup.bothTeamsToScore"), hint);
}

function spreadHandicapLabel(
  option: MarketOption,
  hint: TeamHint | undefined,
  t: WorldCupTranslate,
): string {
  const text =
    `${option.market.outcomes?.[0]?.label ?? ""} ${marketMetaString(
      option.market,
      "polymarket.groupItemTitle",
    )}`.trim() ||
    option.market.question ||
    "";
  const team =
    hint?.homeLabel && textMatchesAny(text, hint.homeKeys)
      ? hint.homeLabel
      : hint?.awayLabel && textMatchesAny(text, hint.awayKeys)
        ? hint.awayLabel
        : option.label;
  const line = Math.abs(marketLine(option.market) ?? option.handicap ?? option.line ?? 0);
  return t("extend.worldcup.spreadHandicap", {
    team,
    line: formatLine(line, false),
  });
}

function totalGoalsLabel(
  option: MarketOption,
  type: SportsMarketType,
  t: WorldCupTranslate,
): string {
  const line = marketLine(option.market) ?? option.line ?? 0;
  return t("extend.worldcup.marketWithLine", {
    market: t(`extend.worldcup.detail.markets.type.${type}`),
    line: formatLine(Math.abs(line), false),
  });
}

function teamTotalGoalsLabel(
  option: MarketOption,
  type: SportsMarketType,
  hint: TeamHint | undefined,
  t: WorldCupTranslate,
): string {
  const line = marketLine(option.market) ?? option.line ?? 0;
  const label = t("extend.worldcup.teamTotalGoals", {
    team: option.label,
    line: formatLine(Math.abs(line), false),
  });
  return periodMarketLabel(type, label, hint);
}

function teamTotalCornersLabel(
  option: MarketOption,
  t: WorldCupTranslate,
): string {
  const line = marketLine(option.market) ?? option.line ?? 0;
  return t("extend.worldcup.teamMarketWithLine", {
    team: option.label,
    market: t("extend.worldcup.detail.markets.type.total_corners"),
    line: formatLine(Math.abs(line), false),
  });
}

export function worldcupMarketOptionDisplayLabel(
  group: MarketGroup,
  option: MarketOption,
  hint: TeamHint | undefined,
  t: WorldCupTranslate,
): string {
  const groupLabel = t(`extend.worldcup.detail.markets.type.${group.type_label}`);
  const optionLabel = option.label;
  if (isMoneylineGroup(group)) return optionLabel;
  if (isBothTeamsToScoreGroup(group)) {
    return bothTeamsToScoreLabel(group.type, hint, t);
  }
  if (group.type === "spreads") {
    return spreadHandicapLabel(option, hint, t);
  }
  if (isTotalGoalsGroup(group)) {
    return totalGoalsLabel(option, group.type, t);
  }
  if (isTeamTotalGoalsGroup(group)) {
    return teamTotalGoalsLabel(option, group.type, hint, t);
  }
  if (isCornerTotalGroup(group)) {
    return totalGoalsLabel(option, group.type, t);
  }
  if (isTeamTotalCornersGroup(group)) {
    return teamTotalCornersLabel(option, t);
  }
  if (isCornerOddEvenGroup(group)) return groupLabel;
  if (group.type === "soccer_exact_score") return optionLabel;
  return group.options.length > 1 ? `${groupLabel} (${optionLabel})` : groupLabel;
}

export function worldcupMarketSelectedSurfaceLabel(
  group: MarketGroup,
  option: MarketOption,
  hint: TeamHint | undefined,
  t: WorldCupTranslate,
): string {
  if (OPTION_ONLY_SURFACE_LABEL_TYPES.has(group.type)) return option.label;
  return worldcupMarketOptionDisplayLabel(group, option, hint, t);
}
