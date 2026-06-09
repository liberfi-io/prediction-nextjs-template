/**
 * Leaderboard BFF client + adapter (self-contained in the template).
 *
 * Talks to prediction-server's ChainStream proxy endpoints
 * (`/api/v1/prediction/*`) and adapts the snake_case transport DTOs into the
 * local camelCase domain shapes the UI consumes. `@chainstream-io/sdk` is NOT
 * imported — the contract is LiberFi-owned end to end.
 *
 * `baseUrl` is the predict API base: the server passes the absolute
 * `PREDICT_URL`; the browser passes the `NEXT_PUBLIC_PREDICT_URL` rewrite
 * prefix (default `/predict-api`).
 */

import { num } from "../format";
import type {
  LeaderboardInterval,
  PositionSortField,
  SmartLeaderboard,
  SmartWalletEntry,
  SortOrder,
  WalletActivitiesPage,
  WalletActivity,
  WalletDailyPnlDetail,
  WalletDailyPnl,
  WalletPnlDetail,
  WalletPnlSummary,
  WalletPositionsPage,
  WalletTokenPnl,
} from "../types";

// ---------------------------------------------------------------------------
// Backend transport DTOs (snake_case, mirror internal/domain/prediction_smart.go)
// ---------------------------------------------------------------------------

interface SmartWalletEntryDto {
  rank: number;
  wallet: string;
  score: string;
  total_pnl: string;
  total_pnl_ratio: string;
  realized_pnl: string;
  unrealized_pnl: string;
  current_value: string;
  total_volume: string;
  total_buy_amount: string;
  win_rate: string;
  win_count: number;
  loss_count: number;
  token_count: number;
  market_count: number;
  open_position_count: number;
  today_realized_pnl: string;
  today_volume: string;
  seven_day_realized_pnl: string;
  seven_day_volume: string;
  seven_day_activity_count: number;
  thirty_day_realized_pnl?: string;
  thirty_day_volume?: string;
  avg_initial_cost: string;
  avg_holding_seconds: string;
  avg_entry_count: string;
  profit_factor: string;
  settlement_ratio: string;
  settlement_win_rate: string;
  best_trade_market_question?: string;
  best_trade_outcome?: string;
  best_trade_pnl?: string;
  worst_trade_market_question?: string;
  worst_trade_outcome?: string;
  worst_trade_pnl?: string;
  last_activity_ts?: string;
  state_quality?: string;
}

interface SmartLeaderboardDto {
  tag?: string;
  interval: string;
  sort_by: string;
  scope?: string;
  state_quality?: string;
  updated_at_ms?: number;
  cursor?: string;
  entries: SmartWalletEntryDto[] | null;
}

interface WalletPnlSummaryDto {
  current_value: string;
  realized_pnl: string;
  unrealized_pnl: string;
  total_pnl: string;
  total_pnl_ratio: string;
  total_buy_amount: string;
  total_sell_amount: string;
  total_redeem_amount: string;
  total_volume: string;
  today_realized_pnl: string;
  today_volume: string;
  seven_day_realized_pnl: string;
  seven_day_volume: string;
  seven_day_activity_count: number;
  seven_day_market_count: number;
  token_count: number;
  market_count: number;
  open_position_count: number;
  win_count: number;
  loss_count: number;
  win_rate: string;
  profit_factor: string;
  settlement_ratio: string;
  settlement_win_rate: string;
  avg_initial_cost: string;
  avg_holding_seconds: string;
  avg_entry_count: string;
  best_trade_market_question?: string;
  best_trade_outcome?: string;
  best_trade_pnl?: string;
  best_trade_event_slug?: string;
  worst_trade_market_question?: string;
  worst_trade_outcome?: string;
  worst_trade_pnl?: string;
  worst_trade_event_slug?: string;
  last_activity_ts?: string;
  state_quality?: string;
}

interface WalletTokenPnlDto {
  token_id: string;
  condition_id: string;
  event_slug?: string;
  market_id?: string;
  market_question: string;
  outcome: string;
  tags?: string[] | null;
  open_quantity: string;
  cost_basis: string;
  avg_entry_price: string;
  avg_sell_price: string;
  last_price: string;
  current_value: string;
  realized_pnl: string;
  unrealized_pnl: string;
  total_pnl: string;
  total_pnl_ratio: string;
  total_buy_amount: string;
  total_sell_amount: string;
  total_redeem_amount: string;
  total_volume: string;
  win_count: number;
  loss_count: number;
  first_activity_ts?: string;
  last_activity_ts?: string;
  state_quality?: string;
  // Best-effort local enrichment (see LocalMarketRef).
  event_title?: string;
  event_image_url?: string;
  market_image_url?: string;
  market_description?: string;
}

interface WalletDailyPnlDto {
  day: string;
  realized_pnl?: string;
  realizedPnl?: string;
  volume: string;
  win_count?: number;
  winCount?: number;
  loss_count?: number;
  lossCount?: number;
  activity_count?: number;
  activityCount?: number;
}

interface WalletPnlDto {
  wallet: string;
  tag?: string;
  summary: WalletPnlSummaryDto;
}

interface WalletDailyPnlResponseDto {
  wallet: string;
  tag?: string;
  daily_pnls?: WalletDailyPnlDto[] | null;
  dailyPnls?: WalletDailyPnlDto[] | null;
}

interface WalletPositionsDto {
  wallet: string;
  tag?: string;
  cursor?: string;
  limit?: number;
  sort_by?: string;
  order?: string;
  tokens: WalletTokenPnlDto[] | null;
}

interface WalletActivityDto {
  activity_id?: string;
  wallet: string;
  type: string;
  outcome: string;
  quantity: string;
  amount: string;
  price: string;
  market_question?: string;
  condition_id?: string;
  token_id?: string;
  event_slug?: string;
  activity_ts?: string;
  // Best-effort local enrichment (see LocalMarketRef).
  event_title?: string;
  event_image_url?: string;
  market_image_url?: string;
  market_description?: string;
}

interface WalletActivitiesDto {
  cursor?: string;
  activities: WalletActivityDto[] | null;
}

// ---------------------------------------------------------------------------
// Adapters: transport DTO → domain
// ---------------------------------------------------------------------------

function adaptEntry(d: SmartWalletEntryDto): SmartWalletEntry {
  return {
    rank: d.rank,
    wallet: d.wallet,
    score: num(d.score),
    totalPnl: num(d.total_pnl),
    totalPnlRatio: num(d.total_pnl_ratio),
    realizedPnl: num(d.realized_pnl),
    unrealizedPnl: num(d.unrealized_pnl),
    currentValue: num(d.current_value),
    totalVolume: num(d.total_volume),
    totalBuyAmount: num(d.total_buy_amount),
    winRate: num(d.win_rate),
    winCount: d.win_count,
    lossCount: d.loss_count,
    tokenCount: d.token_count,
    marketCount: d.market_count,
    openPositionCount: d.open_position_count,
    todayRealizedPnl: num(d.today_realized_pnl),
    todayVolume: num(d.today_volume),
    sevenDayRealizedPnl: num(d.seven_day_realized_pnl),
    sevenDayVolume: num(d.seven_day_volume),
    sevenDayActivityCount: d.seven_day_activity_count,
    thirtyDayRealizedPnl: num(d.thirty_day_realized_pnl),
    thirtyDayVolume: num(d.thirty_day_volume),
    avgInitialCost: num(d.avg_initial_cost),
    avgHoldingSeconds: num(d.avg_holding_seconds),
    avgEntryCount: num(d.avg_entry_count),
    profitFactor: num(d.profit_factor),
    settlementRatio: num(d.settlement_ratio),
    settlementWinRate: num(d.settlement_win_rate),
    bestTradeMarketQuestion: d.best_trade_market_question,
    bestTradeOutcome: d.best_trade_outcome,
    bestTradePnl: num(d.best_trade_pnl),
    worstTradeMarketQuestion: d.worst_trade_market_question,
    worstTradeOutcome: d.worst_trade_outcome,
    worstTradePnl: num(d.worst_trade_pnl),
    lastActivityTs: d.last_activity_ts,
    stateQuality: d.state_quality,
  };
}

function adaptLeaderboard(d: SmartLeaderboardDto): SmartLeaderboard {
  return {
    tag: d.tag ?? "",
    interval: d.interval,
    sortBy: d.sort_by,
    scope: d.scope,
    stateQuality: d.state_quality,
    updatedAtMs: d.updated_at_ms,
    cursor: d.cursor,
    entries: (d.entries ?? []).map(adaptEntry),
  };
}

function adaptSummary(d: WalletPnlSummaryDto): WalletPnlSummary {
  return {
    currentValue: num(d.current_value),
    realizedPnl: num(d.realized_pnl),
    unrealizedPnl: num(d.unrealized_pnl),
    totalPnl: num(d.total_pnl),
    totalPnlRatio: num(d.total_pnl_ratio),
    totalBuyAmount: num(d.total_buy_amount),
    totalSellAmount: num(d.total_sell_amount),
    totalRedeemAmount: num(d.total_redeem_amount),
    totalVolume: num(d.total_volume),
    todayRealizedPnl: num(d.today_realized_pnl),
    todayVolume: num(d.today_volume),
    sevenDayRealizedPnl: num(d.seven_day_realized_pnl),
    sevenDayVolume: num(d.seven_day_volume),
    sevenDayActivityCount: d.seven_day_activity_count,
    sevenDayMarketCount: d.seven_day_market_count,
    tokenCount: d.token_count,
    marketCount: d.market_count,
    openPositionCount: d.open_position_count,
    winCount: d.win_count,
    lossCount: d.loss_count,
    winRate: num(d.win_rate),
    profitFactor: num(d.profit_factor),
    settlementRatio: num(d.settlement_ratio),
    settlementWinRate: num(d.settlement_win_rate),
    avgInitialCost: num(d.avg_initial_cost),
    avgHoldingSeconds: num(d.avg_holding_seconds),
    avgEntryCount: num(d.avg_entry_count),
    bestTradeMarketQuestion: d.best_trade_market_question,
    bestTradeOutcome: d.best_trade_outcome,
    bestTradePnl: num(d.best_trade_pnl),
    bestTradeEventSlug: d.best_trade_event_slug,
    worstTradeMarketQuestion: d.worst_trade_market_question,
    worstTradeOutcome: d.worst_trade_outcome,
    worstTradePnl: num(d.worst_trade_pnl),
    worstTradeEventSlug: d.worst_trade_event_slug,
    lastActivityTs: d.last_activity_ts,
    stateQuality: d.state_quality,
  };
}

function adaptToken(d: WalletTokenPnlDto): WalletTokenPnl {
  return {
    tokenId: d.token_id,
    conditionId: d.condition_id,
    eventSlug: d.event_slug,
    marketId: d.market_id,
    marketQuestion: d.market_question,
    outcome: d.outcome,
    tags: d.tags ?? [],
    openQuantity: num(d.open_quantity),
    costBasis: num(d.cost_basis),
    avgEntryPrice: num(d.avg_entry_price),
    avgSellPrice: num(d.avg_sell_price),
    lastPrice: num(d.last_price),
    currentValue: num(d.current_value),
    realizedPnl: num(d.realized_pnl),
    unrealizedPnl: num(d.unrealized_pnl),
    totalPnl: num(d.total_pnl),
    totalPnlRatio: num(d.total_pnl_ratio),
    totalBuyAmount: num(d.total_buy_amount),
    totalSellAmount: num(d.total_sell_amount),
    totalRedeemAmount: num(d.total_redeem_amount),
    totalVolume: num(d.total_volume),
    winCount: d.win_count,
    lossCount: d.loss_count,
    firstActivityTs: d.first_activity_ts,
    lastActivityTs: d.last_activity_ts,
    stateQuality: d.state_quality,
    eventTitle: d.event_title,
    eventImageUrl: d.event_image_url,
    marketImageUrl: d.market_image_url,
    marketDescription: d.market_description,
  };
}

function adaptDailyPnl(p: WalletDailyPnlDto): WalletDailyPnl {
  return {
    day: p.day,
    realizedPnl: num(p.realized_pnl ?? p.realizedPnl),
    volume: num(p.volume),
    winCount: p.win_count ?? p.winCount ?? 0,
    lossCount: p.loss_count ?? p.lossCount ?? 0,
    activityCount: p.activity_count ?? p.activityCount ?? 0,
  };
}

function adaptWalletPnl(d: WalletPnlDto): WalletPnlDetail {
  return {
    wallet: d.wallet,
    tag: d.tag ?? "",
    summary: adaptSummary(d.summary),
  };
}

function adaptWalletDailyPnl(d: WalletDailyPnlResponseDto): WalletDailyPnlDetail {
  return {
    wallet: d.wallet,
    tag: d.tag ?? "",
    dailyPnls: (d.daily_pnls ?? d.dailyPnls ?? []).map(adaptDailyPnl),
  };
}

function adaptPositions(d: WalletPositionsDto): WalletPositionsPage {
  return {
    cursor: d.cursor,
    sortBy: d.sort_by ?? "totalPnl",
    order: d.order ?? "desc",
    tokens: (d.tokens ?? []).map(adaptToken),
  };
}

function adaptActivity(d: WalletActivityDto): WalletActivity {
  return {
    activityId: d.activity_id,
    wallet: d.wallet,
    type: d.type,
    outcome: d.outcome,
    quantity: num(d.quantity),
    amount: num(d.amount),
    price: num(d.price),
    marketQuestion: d.market_question,
    conditionId: d.condition_id,
    tokenId: d.token_id,
    eventSlug: d.event_slug,
    activityTs: d.activity_ts,
    eventTitle: d.event_title,
    eventImageUrl: d.event_image_url,
    marketImageUrl: d.market_image_url,
    marketDescription: d.market_description,
  };
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const leaderboardQueryKey = (interval: LeaderboardInterval, tag?: string | null) =>
  ["leaderboard", "smart-money", interval, tag || "all"] as const;

export const walletPnlQueryKey = (
  wallet: string,
  interval?: LeaderboardInterval,
  tag?: string | null,
) => ["leaderboard", "wallet-pnl", wallet, interval ?? "all", tag || "all"] as const;

export const walletDailyPnlQueryKey = (
  wallet: string,
  interval?: LeaderboardInterval,
  tag?: string | null,
) => ["leaderboard", "wallet-daily-pnl", wallet, interval ?? "all", tag || "all"] as const;

export const walletPositionsQueryKey = (
  wallet: string,
  sortBy?: PositionSortField,
  order?: SortOrder,
  interval?: LeaderboardInterval,
  tag?: string | null,
) =>
  [
    "leaderboard",
    "wallet-positions",
    wallet,
    sortBy ?? "default",
    order ?? "default",
    interval ?? "all",
    tag || "all",
  ] as const;

export const walletActivitiesQueryKey = (
  wallet: string,
  interval?: LeaderboardInterval,
  tag?: string | null,
) => ["leaderboard", "wallet-activities", wallet, interval ?? "all", tag || "all"] as const;

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function getJson<T>(baseUrl: string, path: string, lang?: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const suffix =
    lang && lang !== "en" ? `${sep}lang=${encodeURIComponent(lang)}` : "";
  const res = await fetch(`${baseUrl}/api/v1/prediction/${path}${suffix}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`prediction ${path} request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * ChainStream tag the board is scoped to. Sent explicitly so the result never
 * depends on the backend's default `CHAINSTREAM_TAG`: the upstream currently has
 * data under `worldcup_2026` (the legacy `worldcup` tag returns an empty list).
 * Override via `NEXT_PUBLIC_PREDICT_LEADERBOARD_TAG` for other deployments.
 */
export const LEADERBOARD_TAG = process.env.NEXT_PUBLIC_PREDICT_LEADERBOARD_TAG ?? "worldcup_2026";

/** Fetch + adapt the smart-money leaderboard for a time window. */
export async function fetchSmartLeaderboard(
  baseUrl: string,
  interval: LeaderboardInterval,
  opts: { limit?: number; lang?: string; tag?: string | null } = {},
): Promise<SmartLeaderboard> {
  const params = new URLSearchParams({ interval });
  const tag = opts.tag === undefined ? LEADERBOARD_TAG : opts.tag;
  if (tag) params.set("tag", tag);
  if (opts.limit) params.set("limit", String(opts.limit));
  return getJson<SmartLeaderboardDto>(
    baseUrl,
    `leaderboard?${params.toString()}`,
    opts.lang,
  ).then(adaptLeaderboard);
}

/** Fetch + adapt a wallet's full PNL detail. */
export async function fetchWalletPnl(
  baseUrl: string,
  wallet: string,
  opts: { lang?: string; interval?: LeaderboardInterval; tag?: string | null } = {},
): Promise<WalletPnlDetail> {
  const params = new URLSearchParams();
  const tag = opts.tag === undefined ? LEADERBOARD_TAG : opts.tag;
  if (tag) params.set("tag", tag);
  if (opts.interval) params.set("interval", opts.interval);
  const qs = params.toString();
  return getJson<WalletPnlDto>(
    baseUrl,
    `wallets/${encodeURIComponent(wallet)}/pnl${qs ? `?${qs}` : ""}`,
    opts.lang,
  ).then(adaptWalletPnl);
}

/**
 * Fetch + adapt a wallet's 7-day daily PNL chart series.
 *
 * The BFF serves the daily series inside the combined `/pnl` payload
 * (`{ wallet, tag, summary, daily_pnls }`) rather than a dedicated
 * `/pnl/daily` route, so we read `daily_pnls` off `/pnl` here; the extra
 * `summary` field is ignored by the daily adapter.
 */
export async function fetchWalletDailyPnl(
  baseUrl: string,
  wallet: string,
  opts: { lang?: string; interval?: LeaderboardInterval; tag?: string | null } = {},
): Promise<WalletDailyPnlDetail> {
  const params = new URLSearchParams();
  const tag = opts.tag === undefined ? LEADERBOARD_TAG : opts.tag;
  if (tag) params.set("tag", tag);
  if (opts.interval) params.set("interval", opts.interval);
  const qs = params.toString();
  return getJson<WalletDailyPnlResponseDto>(
    baseUrl,
    `wallets/${encodeURIComponent(wallet)}/pnl${qs ? `?${qs}` : ""}`,
    opts.lang,
  ).then(adaptWalletDailyPnl);
}

/** Fetch + adapt a page of a wallet's token positions (sorted / paginated). */
export async function fetchWalletPositions(
  baseUrl: string,
  wallet: string,
  opts: {
    sortBy?: PositionSortField;
    order?: SortOrder;
    limit?: number;
    cursor?: string;
    lang?: string;
    interval?: LeaderboardInterval;
    tag?: string | null;
  } = {},
): Promise<WalletPositionsPage> {
  const params = new URLSearchParams();
  const tag = opts.tag === undefined ? LEADERBOARD_TAG : opts.tag;
  if (tag) params.set("tag", tag);
  if (opts.interval) params.set("interval", opts.interval);
  if (opts.sortBy) params.set("sort_by", opts.sortBy);
  if (opts.order) params.set("order", opts.order);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  return getJson<WalletPositionsDto>(
    baseUrl,
    `wallets/${encodeURIComponent(wallet)}/positions?${params.toString()}`,
    opts.lang,
  ).then(adaptPositions);
}

/** Fetch + adapt a wallet's recent trade activities. */
export async function fetchWalletActivities(
  baseUrl: string,
  wallet: string,
  opts: {
    limit?: number;
    cursor?: string;
    lang?: string;
    interval?: LeaderboardInterval;
    tag?: string | null;
  } = {},
): Promise<WalletActivitiesPage> {
  const params = new URLSearchParams();
  const tag = opts.tag === undefined ? LEADERBOARD_TAG : opts.tag;
  if (tag) params.set("tag", tag);
  if (opts.interval) params.set("interval", opts.interval);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  const dto = await getJson<WalletActivitiesDto>(
    baseUrl,
    `wallets/${encodeURIComponent(wallet)}/activities${qs ? `?${qs}` : ""}`,
    opts.lang,
  );
  return {
    cursor: dto.cursor,
    activities: (dto.activities ?? []).map(adaptActivity),
  };
}

/** Default leaderboard page size. */
export const LEADERBOARD_PAGE_SIZE = 50;
