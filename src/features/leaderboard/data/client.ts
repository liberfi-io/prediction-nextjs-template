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
  SmartLeaderboard,
  SmartWalletEntry,
  WalletActivitiesPage,
  WalletActivity,
  WalletDailyPnl,
  WalletPnlDetail,
  WalletPnlSummary,
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
  worst_trade_market_question?: string;
  worst_trade_outcome?: string;
  worst_trade_pnl?: string;
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
}

interface WalletDailyPnlDto {
  day: string;
  realized_pnl: string;
  volume: string;
  win_count: number;
  loss_count: number;
  activity_count: number;
}

interface WalletPnlDto {
  wallet: string;
  tag?: string;
  cursor?: string;
  summary: WalletPnlSummaryDto;
  tokens: WalletTokenPnlDto[] | null;
  daily_pnls: WalletDailyPnlDto[] | null;
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
    worstTradeMarketQuestion: d.worst_trade_market_question,
    worstTradeOutcome: d.worst_trade_outcome,
    worstTradePnl: num(d.worst_trade_pnl),
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
  };
}

function adaptWalletPnl(d: WalletPnlDto): WalletPnlDetail {
  const tokens = (d.tokens ?? []).map(adaptToken);
  const positions = tokens
    .filter((t) => t.openQuantity > 0)
    .sort((a, b) => b.currentValue - a.currentValue);
  const closed = tokens
    .filter((t) => t.openQuantity <= 0)
    .sort((a, b) => b.totalPnl - a.totalPnl);
  const dailyPnls: WalletDailyPnl[] = (d.daily_pnls ?? []).map((p) => ({
    day: p.day,
    realizedPnl: num(p.realized_pnl),
    volume: num(p.volume),
    winCount: p.win_count,
    lossCount: p.loss_count,
    activityCount: p.activity_count,
  }));
  return {
    wallet: d.wallet,
    tag: d.tag ?? "",
    summary: adaptSummary(d.summary),
    positions,
    closed,
    dailyPnls,
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
  };
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const leaderboardQueryKey = (interval: LeaderboardInterval) =>
  ["leaderboard", "smart-money", interval] as const;

export const walletPnlQueryKey = (wallet: string) =>
  ["leaderboard", "wallet-pnl", wallet] as const;

export const walletActivitiesQueryKey = (wallet: string) =>
  ["leaderboard", "wallet-activities", wallet] as const;

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
const LEADERBOARD_TAG = process.env.NEXT_PUBLIC_PREDICT_LEADERBOARD_TAG ?? "worldcup_2026";

/** Fetch + adapt the smart-money leaderboard for a time window. */
export async function fetchSmartLeaderboard(
  baseUrl: string,
  interval: LeaderboardInterval,
  opts: { limit?: number; lang?: string } = {},
): Promise<SmartLeaderboard> {
  const params = new URLSearchParams({ interval });
  if (LEADERBOARD_TAG) params.set("tag", LEADERBOARD_TAG);
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
  opts: { lang?: string } = {},
): Promise<WalletPnlDetail> {
  return getJson<WalletPnlDto>(
    baseUrl,
    `wallets/${encodeURIComponent(wallet)}/pnl`,
    opts.lang,
  ).then(adaptWalletPnl);
}

/** Fetch + adapt a wallet's recent trade activities. */
export async function fetchWalletActivities(
  baseUrl: string,
  wallet: string,
  opts: { limit?: number; cursor?: string; lang?: string } = {},
): Promise<WalletActivitiesPage> {
  const params = new URLSearchParams();
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
