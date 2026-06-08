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
  settlementRatio: number;
  settlementWinRate: number;
  avgInitialCost: number;
  avgHoldingSeconds: number;
  avgEntryCount: number;
  bestTradeMarketQuestion?: string;
  bestTradeOutcome?: string;
  bestTradePnl: number;
  worstTradeMarketQuestion?: string;
  worstTradeOutcome?: string;
  worstTradePnl: number;
  lastActivityTs?: string;
  stateQuality?: string;
}

/** Per-position PNL row. Open positions have openQuantity > 0. */
export interface WalletTokenPnl {
  tokenId: string;
  conditionId: string;
  eventSlug?: string;
  marketId?: string;
  marketQuestion: string;
  outcome: string;
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

/** Full wallet PNL detail, with positions split into open / closed. */
export interface WalletPnlDetail {
  wallet: string;
  tag: string;
  summary: WalletPnlSummary;
  /** Open positions (openQuantity > 0), sorted by current value desc. */
  positions: WalletTokenPnl[];
  /** Closed positions (openQuantity == 0), sorted by total PNL desc. */
  closed: WalletTokenPnl[];
  dailyPnls: WalletDailyPnl[];
}

/** One buy / sell / redeem trade activity. */
export interface WalletActivity {
  activityId?: string;
  wallet: string;
  type: string;
  outcome: string;
  quantity: number;
  amount: number;
  price: number;
  marketQuestion?: string;
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
