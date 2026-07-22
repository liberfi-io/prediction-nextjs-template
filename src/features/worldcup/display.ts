import type { WcMatch } from "./types";
import type { TeamHint } from "./components/detail/marketGrouping";

/** Shared FIFA logo used for World Cup match surfaces. */
export const FIFA_AVATAR = "/worldcup/fifa.webp";

export type WorldCupTranslate = (
  key: `extend.${string}`,
  options?: Record<string, unknown>,
) => string;

/** Build the same localized team hint used by the World Cup detail page. */
export function buildWorldcupTeamHint(
  match: WcMatch | undefined,
  t: WorldCupTranslate,
): TeamHint | undefined {
  if (!match) return undefined;
  const keys = (...vals: string[]) =>
    new Set(vals.filter(Boolean).map((s) => s.trim().toLowerCase()));
  const homeLabel = t(`extend.worldcup.teamName.${match.home.code.toLowerCase()}`, {
    defaultValue: match.home.nameZh || match.home.name,
  });
  const awayLabel = t(`extend.worldcup.teamName.${match.away.code.toLowerCase()}`, {
    defaultValue: match.away.nameZh || match.away.name,
  });
  return {
    homeKeys: keys(match.home.name, match.home.code, match.home.nameZh, homeLabel ?? ""),
    awayKeys: keys(match.away.name, match.away.code, match.away.nameZh, awayLabel ?? ""),
    homeLabel,
    awayLabel,
    drawLabel: t("extend.worldcup.draw"),
    moneylineDrawLabel: t("extend.worldcup.moneylineDraw"),
    teamWinsLabel: (team: string) => t("extend.worldcup.teamWins", { team }),
    yesLabel: t("extend.worldcup.detail.trade.yes"),
    noLabel: t("extend.worldcup.detail.trade.no"),
    firstHalfTotalsLabel: t("extend.worldcup.detail.markets.type.first_half_totals"),
    secondHalfTotalsLabel: t("extend.worldcup.detail.markets.type.second_half_totals"),
    totalCornersLabel: t("extend.worldcup.detail.markets.type.total_corners"),
    teamTotalCornersLabel: t("extend.worldcup.detail.markets.type.total_corners"),
    firstHalfTotalCornersLabel: t(
      "extend.worldcup.detail.markets.type.soccer_first_half_total_corners",
    ),
    secondHalfTotalCornersLabel: t(
      "extend.worldcup.detail.markets.type.soccer_second_half_total_corners",
    ),
    firstHalfPrefixLabel: t("extend.worldcup.firstHalfPrefix"),
    secondHalfPrefixLabel: t("extend.worldcup.secondHalfPrefix"),
    periodMarketLabel: (period: string, market: string) =>
      t("extend.worldcup.periodMarketLabel", { period, market }),
    playerGoalsLabel: t("extend.worldcup.detail.markets.type.soccer_player_goals"),
    playerGoalsShortLabel: t("extend.worldcup.detail.markets.type.soccer_player_goals_short"),
    goalkeeperSavesLabel: t(
      "extend.worldcup.detail.markets.type.soccer_player_goalkeeper_saves",
    ),
    goalkeeperSavesShortLabel: t(
      "extend.worldcup.detail.markets.type.soccer_player_goalkeeper_saves_short",
    ),
    playerAssistsShortLabel: t("extend.worldcup.detail.markets.type.soccer_player_assists_short"),
    playerGoalsPlusAssistsShortLabel: t(
      "extend.worldcup.detail.markets.type.soccer_player_goals_plus_assists_short",
    ),
    playerShotsShortLabel: t("extend.worldcup.detail.markets.type.soccer_player_shots_short"),
    playerShotsOnTargetShortLabel: t(
      "extend.worldcup.detail.markets.type.soccer_player_shots_on_target_short",
    ),
    neitherLabel: t("extend.worldcup.detail.markets.option.neither"),
    anyOtherScoreLabel: t("extend.worldcup.detail.markets.option.anyOtherScore"),
  };
}

/** Match title aligned with World Cup detail page header. */
export function worldcupMatchTitle(
  match: WcMatch | undefined,
  hint: TeamHint | undefined,
): string | undefined {
  if (!match || !hint?.homeLabel || !hint.awayLabel) return undefined;
  return `${hint.homeLabel} vs. ${hint.awayLabel}`;
}
