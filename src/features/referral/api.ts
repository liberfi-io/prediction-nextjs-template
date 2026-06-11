/**
 * Thin REST client for the prediction-server referral/rebate endpoints
 * (`/api/v1/referral/*`). All requests go through the same `NEXT_PUBLIC_PREDICT_URL`
 * proxy the rest of the app uses, so they share auth/cors/rewrite behavior.
 *
 * Money fields returned by the server are integer USDC micro-units (1e6). The
 * UI converts to dollars with {@link microToUsd}.
 */

const PREDICT_BASE = process.env.NEXT_PUBLIC_PREDICT_URL || "/predict-api";
const REFERRAL_BASE = `${PREDICT_BASE}/api/v1/referral`;

/** GET /referral/config */
export interface ReferralConfig {
  builder_enabled: boolean;
  builder_code: string;
  builder_taker_fee_bps: number;
  builder_maker_fee_bps: number;
  commission_ratio: number;
}

/** GET /referral/invite_code */
export interface InviteCodeResponse {
  invite_code: string;
  rebate_ratio: number;
  has_bound_inviter: boolean;
}

/** GET /referral/profile — amounts are USDC micro-units. */
export interface RebateProfile {
  total_amount: number;
  free_amount: number;
  lock_amount: number;
  claimed_amount: number;
  can_claim: boolean;
  min_claim_amount: number;
}

/** GET /referral/invitees — one downstream user with aggregated totals. */
export interface InviteeSummary {
  invitee_user_address: string;
  invite_code: string;
  joined_at: string;
  total_trade_amount: number;
  total_rebate_amount: number;
}

/** GET /referral/trades — one per-fill rebate detail. */
export interface RebateTradeItem {
  invitee_user_address: string;
  source: string;
  source_trade_id: string;
  trade_amount: number;
  rebate_amount: number;
  status: string;
  created_at: string;
  // Optional display enrichment (nil when the market isn't synced locally).
  event_id?: number;
  event_title?: string;
  market_id?: number;
  market_question?: string;
  outcome?: string;
}

/** POST /referral/bind */
export interface BindReferralResponse {
  bound: boolean;
  inviter_user_address?: string;
  has_bound_inviter: boolean;
}

/** POST /referral/claim */
export interface ClaimResponse {
  claim_id: number;
  amount: number;
  status: string;
  tx_hash?: string;
}

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`request failed (${res.status}): ${await safeText(res)}`);
  }
  return (await res.json()) as T;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    throw new Error(`request failed (${res.status}): ${await safeText(res)}`);
  }
  return (await res.json()) as T;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return res.statusText;
  }
}

export const referralApi = {
  config: (signal?: AbortSignal) =>
    getJSON<ReferralConfig>(`${REFERRAL_BASE}/config`, signal),

  inviteCode: (eoa: string, signal?: AbortSignal) =>
    getJSON<InviteCodeResponse>(
      `${REFERRAL_BASE}/invite_code?user_address=${encodeURIComponent(eoa)}`,
      signal,
    ),

  profile: (eoa: string, signal?: AbortSignal) =>
    getJSON<RebateProfile>(
      `${REFERRAL_BASE}/profile?user_address=${encodeURIComponent(eoa)}`,
      signal,
    ),

  invitees: (eoa: string, page: number, pageSize: number, signal?: AbortSignal) =>
    getJSON<InviteeSummary[]>(
      `${REFERRAL_BASE}/invitees?user_address=${encodeURIComponent(eoa)}&page=${page}&page_size=${pageSize}`,
      signal,
    ),

  trades: (eoa: string, page: number, pageSize: number, signal?: AbortSignal) =>
    getJSON<RebateTradeItem[]>(
      `${REFERRAL_BASE}/trades?user_address=${encodeURIComponent(eoa)}&page=${page}&page_size=${pageSize}`,
      signal,
    ),

  bind: (params: { invite_code: string; user_address: string; safe_address?: string }) =>
    postJSON<BindReferralResponse>(`${REFERRAL_BASE}/bind`, params),

  claim: (eoa: string) =>
    postJSON<ClaimResponse>(
      `${REFERRAL_BASE}/claim?user_address=${encodeURIComponent(eoa)}`,
      { user_address: eoa },
    ),
};

/** Convert integer USDC micro-units to a number of dollars. */
export function microToUsd(micro: number | null | undefined): number {
  if (!micro) return 0;
  return micro / 1_000_000;
}

/** Format a USDC micro-unit value as a `$x.xx` string (2dp, no rounding up). */
export function formatMicroUsd(micro: number | null | undefined, dp = 2): string {
  const v = microToUsd(micro);
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
}
