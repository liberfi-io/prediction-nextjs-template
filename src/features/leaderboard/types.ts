/**
 * Leaderboard feature domain types (camelCase, app-facing).
 *
 * These are the local domain shapes the UI consumes. The data client
 * (`data/client.ts`) fetches the prediction-server snake_case transport DTOs
 * (which proxy the upstream ChainStream prediction API) and adapts them into
 * these. Money / ratio / price values arrive as high-precision decimal strings
 * upstream; the adapter parses them into numbers for display-only formatting.
 */

/** Leaderboard time window. Mirrors the SDK `PredictionLeaderboardInterval`. */
export type LeaderboardInterval = "1d" | "7d" | "30d" | "all";

/** One ranked smart-money wallet on the board. */
export interface SmartWalletEntry {
  rank: number;
  wallet: string;
  score: number;
  totalPnl: number;
  totalPnlRatio: number;
  realizedPnl: number;
  unrealizedPnl: number;
  currentValue: number;
  totalVolume: number;
  totalBuyAmount: number;
  winRate: number;
  winCount: number;
  lossCount: number;
  tokenCount: number;
  marketCount: number;
  openPositionCount: number;
  todayRealizedPnl: number;
  todayVolume: number;
  sevenDayRealizedPnl: number;
  sevenDayVolume: number;
  sevenDayActivityCount: number;
  thirtyDayRealizedPnl: number;
  thirtyDayVolume: number;
  avgInitialCost: number;
  avgHoldingSeconds: number;
  avgEntryCount: number;
  profitFactor: number;
  settlementRatio: number;
  settlementWinRate: number;
  bestTradeMarketQuestion?: string;
  bestTradeOutcome?: string;
  bestTradePnl: number;
  worstTradeMarketQuestion?: string;
  worstTradeOutcome?: string;
  worstTradePnl: number;
  lastActivityTs?: string;
  stateQuality?: string;
}

/** A page of the smart-money leaderboard. */
export interface SmartLeaderboard {
  tag: string;
  interval: string;
  sortBy: string;
  scope?: string;
  stateQuality?: string;
  updatedAtMs?: number;
  cursor?: string;
  entries: SmartWalletEntry[];
}

/** Aggregate PNL snapshot for one wallet. */
export interface WalletPnlSummary {
  currentValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalPnlRatio: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  totalRedeemAmount: number;
  totalVolume: number;
  todayRealizedPnl: number;
  todayVolume: number;
  sevenDayRealizedPnl: number;
  sevenDayVolume: number;
  sevenDayActivityCount: number;
  sevenDayMarketCount: number;
  tokenCount: number;
  marketCount: number;
  openPositionCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  profitFactor: number;
  /**
   * On-chain settlement ratio / win rate. `null` when the wallet has no
   * RESOLVED settlement yet (upstream omits the field) — distinct from a real
   * 0% rate. Render absence as "—", never 0%.
   */
  settlementRatio: number | null;
  settlementWinRate: number | null;
  avgInitialCost: number;
  avgHoldingSeconds: number;
  avgEntryCount: number;
  bestTradeMarketQuestion?: string;
  bestTradeOutcome?: string;
  bestTradePnl: number;
  /** Local-enriched event slug for the best trade's market; links to event detail when present. */
  bestTradeEventSlug?: string;
  bestTradeEventTitle?: string;
  bestTradeEventTitleTrans?: string;
  worstTradeMarketQuestion?: string;
  worstTradeOutcome?: string;
  worstTradePnl: number;
  /** Local-enriched event slug for the worst trade's market; links to event detail when present. */
  worstTradeEventSlug?: string;
  worstTradeEventTitle?: string;
  worstTradeEventTitleTrans?: string;
  lastActivityTs?: string;
  stateQuality?: string;
}

/**
 * Best-effort local event/market enrichment attached to positions & activities
 * by prediction-server. All fields are optional: they are absent when the
 * referenced market/event is not indexed locally. Title/description are
 * localized to the request language (English fallback).
 */
export interface LocalMarketRef {
  eventTitle?: string;
  eventTitleTrans?: string;
  eventImageUrl?: string;
  marketImageUrl?: string;
  marketDescription?: string;
  marketDescriptionTrans?: string;
  event?: SmartEventRef;
  market?: SmartMarketRef;
}

export interface SmartEventRef {
  slug?: string;
  title?: string;
  titleTrans?: string;
  imageUrl?: string;
  kind?: "regular" | "worldcup_match" | "worldcup_related" | string;
  worldcupMatchSlug?: string;
}

export interface SmartOutcomeRef {
  key?: string;
  label?: string;
  labelTrans?: string;
}

export interface SmartMarketRef {
  slug?: string;
  eventSlug?: string;
  question?: string;
  questionTrans?: string;
  description?: string;
  descriptionTrans?: string;
  imageUrl?: string;
  outcomes?: SmartOutcomeRef[];
  providerMeta?: Record<string, unknown>;
}

/** Position lifecycle status (upstream-computed). */
export type PositionStatus = "holding" | "closed" | "settled";

/** Per-position PNL row. Open positions have openQuantity > 0. */
export interface WalletTokenPnl extends LocalMarketRef {
  tokenId: string;
  conditionId: string;
  eventSlug?: string;
  marketId?: string;
  marketQuestion: string;
  marketQuestionTrans?: string;
  outcome: string;
  outcomeTrans?: string;
  /** Category / product tags this position belongs to (e.g. worldcup_2026). */
  tags: string[];
  /**
   * Lifecycle status: "holding" (open_quantity > 0, unresolved), "closed"
   * (sold out, unresolved), "settled" (market RESOLVED on-chain). Absent on
   * older backends.
   */
  status?: PositionStatus;
  /** 0 or 1 — whether the market has resolved on-chain. */
  marketResolved?: number;
  /** On-chain winning outcome name; empty until settled. */
  winningOutcome?: string;
  openQuantity: number;
  costBasis: number;
  avgEntryPrice: number;
  avgSellPrice: number;
  lastPrice: number;
  currentValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalPnlRatio: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  totalRedeemAmount: number;
  totalVolume: number;
  winCount: number;
  lossCount: number;
  firstActivityTs?: string;
  lastActivityTs?: string;
  stateQuality?: string;
}

/** One day of realized PNL for the trend chart. */
export interface WalletDailyPnl {
  day: string;
  realizedPnl: number;
  volume: number;
  winCount: number;
  lossCount: number;
  activityCount: number;
}

/** Wallet 7-day daily PNL trend. */
export interface WalletDailyPnlDetail {
  wallet: string;
  tag: string;
  dailyPnls: WalletDailyPnl[];
}

/**
 * Wallet PNL detail: the aggregate summary. Daily series and token positions
 * are served separately by /pnl/daily and /positions.
 */
export interface WalletPnlDetail {
  wallet: string;
  tag: string;
  summary: WalletPnlSummary;
}

/** Token-position sort fields supported by the /positions endpoint. */
export type PositionSortField =
  | "totalPnl"
  | "realizedPnl"
  | "unrealizedPnl"
  | "lastActive";

/** Sort direction. */
export type SortOrder = "asc" | "desc";

/** A page of a wallet's token positions (cursor-paginated, server-sorted). */
export interface WalletPositionsPage {
  cursor?: string;
  sortBy: string;
  order: string;
  tokens: WalletTokenPnl[];
}

/** One buy / sell / redeem trade activity. */
export interface WalletActivity extends LocalMarketRef {
  activityId?: string;
  wallet: string;
  type: string;
  outcome: string;
  outcomeTrans?: string;
  quantity: number;
  amount: number;
  price: number;
  marketQuestion?: string;
  marketQuestionTrans?: string;
  conditionId?: string;
  tokenId?: string;
  eventSlug?: string;
  activityTs?: string;
}

/** A page of wallet activities. */
export interface WalletActivitiesPage {
  cursor?: string;
  activities: WalletActivity[];
}

export type SmartMoneyLiveActivityType =
  | "buy"
  | "sell"
  | "redeem"
  | "inventory_adjust"
  | "merge"
  | "split"
  | "unknown";

/** One smart-money live feed row. `timestamp` is normalized to epoch milliseconds. */
export interface SmartMoneyLiveActivity extends LocalMarketRef {
  activityId?: string;
  type: SmartMoneyLiveActivityType;
  wallet: string;
  taker?: string;
  traderName?: string;
  traderImage?: string;
  traderTags: string[];
  conditionId?: string;
  marketId?: string;
  marketQuestion?: string;
  marketQuestionTrans?: string;
  marketIcon?: string;
  eventSlug?: string;
  tokenId?: string;
  outcome?: string;
  outcomeTrans?: string;
  price: number;
  quantity: number;
  amount: number;
  amountInUsd: number;
  timestamp?: number;
  logIndex?: number;
  txHash?: string;
  seqIndex?: string;
  source?: string;
  tags: string[];
}

/** A page of smart-money live feed activities. */
export interface SmartMoneyLiveFeedPage {
  tag?: string;
  cursor?: string | null;
  limit: number;
  order: "desc";
  retentionDays?: number;
  activities: SmartMoneyLiveActivity[];
}
