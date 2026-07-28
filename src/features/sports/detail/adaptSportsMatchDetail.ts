import type { PredictEvent, PredictMarket } from "@liberfi.io/react-predict";
import type { WcMatch, WcOutcome, WcTeam } from "src/features/worldcup/types";
import type {
  SportsLiveState,
  SportsMarket,
  SportsMarketGroup,
  SportsMatchDetail,
  SportsParticipant,
} from "../types";

export interface SportsMatchDetailViewModel {
  event: PredictEvent;
  match: WcMatch;
}

/** Adapts the generic Sports BFF aggregate to the shared match-detail view. */
export function adaptSportsMatchDetail(
  detail: SportsMatchDetail,
  marketGroups: SportsMarketGroup[] = detail.market_groups ?? [],
  liveState: SportsLiveState | undefined = detail.live_state,
): SportsMatchDetailViewModel {
  const markets = marketGroups.flatMap((group) =>
    (group.markets ?? []).map((market) => adaptMarket(detail, market)),
  );
  const source = resolveEventSource(detail, markets);
  const participants = resolveParticipants(detail.participants);
  const status = resolveMatchStatus(liveState?.status ?? detail.status);
  const kickoffMs = detail.start_time
    ? Date.parse(detail.start_time)
    : Number.NaN;
  const eventStatus = status === "final" ? "closed" : "open";
  const volume = sumFinite(markets.map((market) => market.volume));
  const liquidity = sumFinite(markets.map((market) => market.liquidity));
  const moneyline = resolveMoneyline(
    markets,
    participants.home,
    participants.away,
  );

  const event: PredictEvent = {
    slug: detail.match_group_slug,
    title: detail.title,
    image_url: participants.home.flag || participants.away.flag || undefined,
    status: eventStatus,
    start_at: detail.start_time,
    volume,
    liquidity,
    markets,
    source,
    provider_meta: {
      "sports.section": detail.section,
      "sports.sportSlug": detail.sport_slug,
      "sports.gameSlug": detail.game_slug,
      "sports.leagueSlug": detail.league_slug,
    },
  };

  const match: WcMatch = {
    matchId: detail.match_group_slug,
    stage:
      detail.league_slug ?? detail.sport_slug ?? detail.game_slug ?? "sports",
    kickoffMs: Number.isFinite(kickoffMs) ? kickoffMs : 0,
    status,
    home: participants.home,
    away: participants.away,
    slug: detail.match_group_slug,
    volume,
    marketCount: detail.market_count ?? markets.length,
    liveScore: resolveLiveScore(liveState),
    livePeriod: resolveLivePeriod(liveState),
    moneyline,
    spread: {
      line: 0,
      home: emptyOutcome(participants.home.name),
      away: emptyOutcome(participants.away.name),
    },
    total: {
      line: 0,
      over: emptyOutcome("Over"),
      under: emptyOutcome("Under"),
    },
  };

  return { event, match };
}

function adaptMarket(
  detail: SportsMatchDetail,
  market: SportsMarket,
): PredictMarket {
  const isOpen =
    market.active !== false &&
    market.closed !== true &&
    market.accepting_orders !== false;

  return {
    slug: market.market_slug,
    event_slug: detail.match_group_slug,
    question: market.label,
    status: isOpen ? "open" : market.closed ? "closed" : "pending",
    start_at: detail.start_time,
    outcomes: (market.outcomes ?? []).map((outcome) => ({
      key: outcome.outcome,
      label: outcome.label,
      price: outcome.price ?? outcome.last_trade_price,
      best_bid: outcome.best_bid,
      best_ask: outcome.best_ask,
    })),
    volume: market.volume,
    liquidity: market.liquidity,
    source: resolveMarketSource(market),
    provider_meta: {
      "polymarket.conditionId": market.condition_id,
      "polymarket.sportsMarketType": market.market_type,
      "polymarket.line": market.line,
      "polymarket.groupItemTitle": market.label,
      "sports.marketCategory": market.market_category,
      "sports.period": market.period,
    },
  };
}

function resolveMarketSource(market: SportsMarket): PredictMarket["source"] {
  const sources = new Set(
    (market.outcomes ?? [])
      .map((outcome) => outcome.orderbook?.source)
      .filter((source) => source !== undefined),
  );
  if (sources.size > 1) {
    throw new Error(`Sports market ${market.market_slug} mixes data sources`);
  }
  const outcomeSource = sources.values().next().value;
  if (market.source && outcomeSource && market.source !== outcomeSource) {
    throw new Error(
      `Sports market ${market.market_slug} has conflicting source`,
    );
  }
  const source = market.source ?? outcomeSource;
  if (!source) {
    throw new Error(
      `Sports market ${market.market_slug} has no canonical source`,
    );
  }
  return source;
}

function resolveEventSource(
  detail: SportsMatchDetail,
  markets: PredictMarket[],
): PredictEvent["source"] {
  const sources = new Set(markets.map((market) => market.source));
  if (detail.source) sources.add(detail.source);
  if (sources.size !== 1) {
    throw new Error(
      `Sports match ${detail.match_group_slug} does not have one canonical source`,
    );
  }
  return sources.values().next().value!;
}

function resolveLiveScore(
  liveState: SportsLiveState | undefined,
): { home: number; away: number } | undefined {
  const value = liveState?.score ?? liveState?.score_state;
  if (Array.isArray(value) && value.length >= 2) {
    const home = finiteScore(value[0]);
    const away = finiteScore(value[1]);
    return home === undefined || away === undefined
      ? undefined
      : { home, away };
  }
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const home = finiteScore(
    record.home ?? record.home_score ?? nestedScore(record.home_team),
  );
  const away = finiteScore(
    record.away ?? record.away_score ?? nestedScore(record.away_team),
  );
  return home === undefined || away === undefined ? undefined : { home, away };
}

function nestedScore(value: unknown): unknown {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return record.score ?? record.value;
}

function finiteScore(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveLivePeriod(
  liveState: SportsLiveState | undefined,
): string | undefined {
  const parts = [liveState?.status_text, liveState?.period, liveState?.clock]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value, index, values) => values.indexOf(value) === index);
  return parts.length ? parts.join(" · ") : undefined;
}

function resolveParticipants(participants: SportsParticipant[] | undefined): {
  home: WcTeam;
  away: WcTeam;
} {
  const values = participants ?? [];
  const home =
    values.find((participant) => participant.role === "home") ?? values[0];
  const away =
    values.find((participant) => participant.role === "away") ?? values[1];
  return {
    home: adaptTeam(home, "HOME"),
    away: adaptTeam(away, "AWAY"),
  };
}

function adaptTeam(
  participant: SportsParticipant | undefined,
  fallbackCode: string,
): WcTeam {
  const name = participant?.name || fallbackCode;
  return {
    code: `sports-${(participant?.abbreviation || fallbackCode).toLowerCase()}`,
    name,
    nameZh: name,
    color: participant?.color || "#71717a",
    flag: participant?.logo_url || "",
  };
}

function resolveMoneyline(
  markets: PredictMarket[],
  home: WcTeam,
  away: WcTeam,
): WcMatch["moneyline"] {
  const candidates = markets.filter(
    (market) =>
      market.provider_meta?.["polymarket.sportsMarketType"] === "moneyline" ||
      market.provider_meta?.["polymarket.sportsMarketType"] ===
        "soccer_match_winner",
  );
  const draw = candidates.find((market) =>
    /\b(draw|tie)\b/i.test(market.question),
  );
  const homeMarket = candidates.find(
    (market) => market !== draw && containsTeam(market.question, home),
  );
  const awayMarket = candidates.find(
    (market) => market !== draw && containsTeam(market.question, away),
  );

  return {
    home: primaryOutcome(homeMarket, home.name),
    draw: primaryOutcome(draw, "Draw"),
    away: primaryOutcome(awayMarket, away.name),
  };
}

function containsTeam(question: string, team: WcTeam): boolean {
  const text = question.toLowerCase();
  return [team.name, team.code]
    .filter(Boolean)
    .some((value) => text.includes(value.toLowerCase()));
}

function primaryOutcome(
  market: PredictMarket | undefined,
  label: string,
): WcOutcome {
  const outcome = market?.outcomes[0];
  return {
    label,
    price: outcome?.price ?? outcome?.best_ask ?? 0,
    bestBid: outcome?.best_bid,
    bestAsk: outcome?.best_ask,
    marketSlug: market?.slug,
    marketSource: market?.source,
  };
}

function emptyOutcome(label: string): WcOutcome {
  return { label, price: 0 };
}

function resolveMatchStatus(status: string | undefined): WcMatch["status"] {
  const normalized = status?.toLowerCase();
  if (normalized === "live" || normalized === "in_progress") return "live";
  if (
    normalized === "final" ||
    normalized === "finished" ||
    normalized === "closed" ||
    normalized === "settled"
  ) {
    return "final";
  }
  return "scheduled";
}

function sumFinite(values: Array<number | undefined>): number {
  return values.reduce<number>(
    (total, value) =>
      typeof value === "number" && Number.isFinite(value)
        ? total + value
        : total,
    0,
  );
}
