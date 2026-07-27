import { useMemo } from "react";
import type { PredictMarket } from "@liberfi.io/react-predict";
import { useWorldcupMatches } from "../../worldcup/data/queries";
import { resolveWorldcupEventAttribution } from "../../worldcup/data/resolve-event-attribution";
import {
  FIFA_AVATAR,
  buildWorldcupTeamHint,
  worldcupMatchTitle,
  type WorldCupTranslate,
} from "../../worldcup/display";
import {
  marketLabel as worldcupMarketLabel,
  sportsType,
} from "../../worldcup/components/detail/marketGrouping";
import type { WcMatch } from "../../worldcup/types";
import type {
  SmartOutcomeRef,
  WalletActivity,
  WalletTokenPnl,
} from "../types";

export function transText(trans: string | undefined, base: string | undefined): string {
  return trans || base || "";
}

export interface LeaderboardDisplayItem {
  eventSlug?: string;
  eventTitle?: string;
  eventTitleTrans?: string;
  eventImageUrl?: string;
  marketImageUrl?: string;
  marketQuestion?: string;
  marketQuestionTrans?: string;
  outcome?: string;
  outcomeTrans?: string;
  conditionId?: string;
  tokenId?: string;
  event?: (WalletTokenPnl | WalletActivity)["event"];
  market?: (WalletTokenPnl | WalletActivity)["market"];
}

export type WorldcupMatchBySlug = Map<string, WcMatch>;

function hasStructuralKey(
  outcome: SmartOutcomeRef,
): outcome is SmartOutcomeRef & { key: string } {
  return typeof outcome.key === "string" && outcome.key.length > 0;
}

export interface LeaderboardDisplay {
  title: string;
  subtitle: string;
  imageUrl?: string;
  outcomeLabel?: string;
}

function leaderboardEventTitle(item: LeaderboardDisplayItem): string {
  return (
    transText(item.event?.titleTrans, item.event?.title) ||
    transText(item.eventTitleTrans, item.eventTitle) ||
    transText(item.market?.questionTrans, item.market?.question) ||
    transText(item.marketQuestionTrans, item.marketQuestion) ||
    "—"
  );
}

function leaderboardOutcomeLabel(item: LeaderboardDisplayItem): string {
  const outcome = item.market?.outcomes?.[0];
  return (
    transText(item.outcomeTrans, item.outcome) ||
    transText(outcome?.labelTrans, outcome?.label) ||
    ""
  );
}

function leaderboardMarketQuestion(item: LeaderboardDisplayItem): string {
  return (
    transText(item.market?.questionTrans, item.market?.question) ||
    transText(item.marketQuestionTrans, item.marketQuestion) ||
    leaderboardOutcomeLabel(item)
  );
}

export function worldcupMatchSlugForLeaderboardItem(item: LeaderboardDisplayItem): string | null {
  if (item.event?.worldcupMatchSlug) return item.event.worldcupMatchSlug;
  const slug = item.market?.eventSlug || item.event?.slug || item.eventSlug;
  if (!slug) return null;
  return resolveWorldcupEventAttribution(slug)?.matchSlug ?? null;
}

function toWorldcupPredictMarket(item: LeaderboardDisplayItem): PredictMarket | undefined {
  const market = item.market;
  if (!market) return undefined;
  const outcomes = market.outcomes ?? [];
  if (outcomes.length === 0 || !outcomes.every(hasStructuralKey)) {
    return undefined;
  }
  return {
    slug: market.slug || item.conditionId || item.tokenId || "",
    source: "polymarket",
    status: "open",
    event_slug: market.eventSlug || item.event?.slug || item.eventSlug || "",
    question: market.question || item.marketQuestion || item.marketQuestionTrans || market.questionTrans || "",
    question_trans: market.questionTrans || item.marketQuestionTrans,
    image_url: market.imageUrl,
    outcomes: outcomes.map((outcome) => ({
      key: outcome.key,
      label: outcome.label || "",
      label_trans: outcome.labelTrans,
    })),
    provider_meta: market.providerMeta,
  } as PredictMarket;
}

function isWorldcupMoneylineMarket(market: PredictMarket): boolean {
  const type = sportsType(market);
  return type === "moneyline" || type === "soccer_match_winner";
}

function worldcupMoneylineOutcomeLabel(
  market: PredictMarket | undefined,
  match: WcMatch,
  translate: WorldCupTranslate,
): string | undefined {
  if (!market || !isWorldcupMoneylineMarket(market)) return undefined;
  const hint = buildWorldcupTeamHint(match, translate);
  const label = worldcupMarketLabel(market, hint);
  if (!label) return undefined;
  if (hint?.drawLabel && label === hint.drawLabel) {
    return translate("extend.worldcup.moneylineDraw");
  }
  if (hint?.homeLabel && label === hint.homeLabel) {
    return translate("extend.worldcup.teamWins", { team: hint.homeLabel });
  }
  if (hint?.awayLabel && label === hint.awayLabel) {
    return translate("extend.worldcup.teamWins", { team: hint.awayLabel });
  }
  return undefined;
}

export function leaderboardDisplay(
  item: LeaderboardDisplayItem,
  worldcupMatchBySlug: WorldcupMatchBySlug,
  translate: WorldCupTranslate,
): LeaderboardDisplay {
  const matchSlug = worldcupMatchSlugForLeaderboardItem(item);
  const match = matchSlug ? worldcupMatchBySlug.get(matchSlug) : undefined;
  if (match) {
    const hint = buildWorldcupTeamHint(match, translate);
    const market = toWorldcupPredictMarket(item);
    const outcomeLabel = worldcupMoneylineOutcomeLabel(market, match, translate);
    return {
      title: worldcupMatchTitle(match, hint) ?? leaderboardEventTitle(item),
      subtitle: outcomeLabel
        ? ""
        : market
          ? worldcupMarketLabel(market, hint)
          : leaderboardMarketQuestion(item),
      imageUrl: FIFA_AVATAR,
      outcomeLabel,
    };
  }

  return {
    title: leaderboardEventTitle(item),
    subtitle: leaderboardOutcomeLabel(item),
    imageUrl: item.market?.imageUrl || item.marketImageUrl || item.event?.imageUrl || item.eventImageUrl,
  };
}

export function useWorldcupMatchBySlug(
  items: LeaderboardDisplayItem[],
  enabled = true,
): WorldcupMatchBySlug {
  const hasWorldcupRows = useMemo(
    () => enabled && items.some((item) => Boolean(worldcupMatchSlugForLeaderboardItem(item))),
    [enabled, items],
  );
  const { data } = useWorldcupMatches({ enabled: hasWorldcupRows });
  return useMemo(
    () => new Map((data ?? []).map((match) => [match.slug, match])),
    [data],
  );
}
