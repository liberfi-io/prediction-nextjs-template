"use client";

import type {
  MatchMarketFlat,
  PredictEvent,
  PredictMarket,
  ProviderSource,
} from "@liberfi.io/react-predict";
import type { TradeOutcome, TradeSide } from "@liberfi.io/ui-predict";
import { isLikelyMpChatLaunch } from "../features/mpchat-miniapp/launchParams";
import { isLikelyTelegramMiniAppLaunch } from "../features/telegram-miniapp/launchParams";
import type { WcMatch } from "../features/worldcup/types";

declare global {
  interface Window {
    gtag?: (
      command: "event",
      eventName: string,
      params?: Record<string, string | number | boolean | undefined>,
    ) => void;
  }
}

export type AnalyticsAppSource = "telegram_miniapp" | "mp_miniapp" | "web";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

function compactParams(params: AnalyticsParams): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  ) as Record<string, string | number | boolean>;
}

export function resolveAnalyticsAppSource(): AnalyticsAppSource {
  if (typeof window === "undefined") return "web";
  try {
    if (isLikelyTelegramMiniAppLaunch()) return "telegram_miniapp";
    if (isLikelyMpChatLaunch()) return "mp_miniapp";
  } catch {
    return "web";
  }
  return "web";
}

function pageParams(): AnalyticsParams {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  return {
    app_source: resolveAnalyticsAppSource(),
    page_path: window.location.pathname,
    page_location: window.location.href,
    referrer: document.referrer || undefined,
    ...Object.fromEntries(
      UTM_KEYS.map((key) => [key, params.get(key) ?? undefined]),
    ),
  };
}

export function trackAnalyticsEvent(
  eventName: string,
  params: AnalyticsParams = {},
): void {
  if (typeof window === "undefined") return;

  try {
    window.gtag?.("event", eventName, compactParams({
      ...pageParams(),
      ...params,
    }));
  } catch {
    // Analytics must never interrupt rendering, navigation, or trading flows.
  }
}

export function trackMatchListView(params: {
  listName: "matches" | "events" | "world_cup_matches";
  matchCount?: number;
  mode?: string;
}): void {
  trackAnalyticsEvent("prediction_match_list_view", params);
}

export function trackMatchDetailView(params: {
  eventSlug: string;
  source: ProviderSource;
  surface?: "prediction_detail" | "world_cup_detail";
  marketSlug?: string;
}): void {
  trackAnalyticsEvent("prediction_match_detail_view", {
    event_slug: params.eventSlug,
    provider_source: params.source,
    surface: params.surface,
    market_slug: params.marketSlug,
  });
}

export function trackOrderClick(params: {
  eventSlug?: string;
  eventTitle?: string;
  marketSlug?: string;
  marketQuestion?: string;
  providerSource?: ProviderSource;
  outcome?: TradeOutcome | "yes" | "no";
  side?: TradeSide | "buy" | "sell";
  surface:
    | "events_list"
    | "matches_list"
    | "prediction_detail"
    | "world_cup_list"
    | "world_cup_detail";
} & AnalyticsParams): void {
  const {
    eventSlug,
    eventTitle,
    marketSlug,
    marketQuestion,
    providerSource,
    side,
    ...rest
  } = params;
  trackAnalyticsEvent("prediction_order_click", {
    ...rest,
    event_slug: eventSlug,
    event_title: eventTitle,
    market_slug: marketSlug,
    market_question: marketQuestion,
    provider_source: providerSource,
    outcome: params.outcome,
    trade_side: side,
  });
}

export function predictEventAnalyticsParams(event: PredictEvent): AnalyticsParams {
  return {
    event_slug: event.slug,
    event_title: event.title,
    provider_source: event.source,
  };
}

export function predictMarketAnalyticsParams(market: PredictMarket): AnalyticsParams {
  return {
    market_slug: market.slug,
    market_question: market.question,
  };
}

export function matchMarketAnalyticsParams(match: MatchMarketFlat): AnalyticsParams {
  return {
    match_id: match.match_id,
    event_a_title: match.event_a_title,
    event_b_title: match.event_b_title,
    provider_source_a: match.source_a,
    provider_source_b: match.source_b,
  };
}

export function worldCupMatchAnalyticsParams(match: WcMatch): AnalyticsParams {
  return {
    match_id: match.matchId,
    match_slug: match.slug,
    match_status: match.status,
    home_team: match.home.code || match.home.name,
    away_team: match.away.code || match.away.name,
  };
}
