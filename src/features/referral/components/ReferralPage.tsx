"use client";

/**
 * Referral / rebate page, built directly in the template (not react-sdk).
 *
 * Responsive strategy mirrors future.news/referral: a single page with CSS
 * reflow (no JS component-tree branching). Mobile stacks vertically; desktop
 * (lg) splits into a left column (reward cards + tabs + list) and a right
 * column (invite card). Only the share action branches on screen size to use
 * the Web Share API on mobile.
 */

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "@liberfi.io/i18n";
import { useAuth } from "@liberfi.io/wallet-connector";
import { usePredictWallet } from "@liberfi.io/ui-predict";
import { truncateAddress } from "@liberfi.io/utils";
import { cn, useScreen } from "@liberfi.io/ui";
import {
  useClaimRebate,
  useInviteCode,
  useInvitees,
  useRebateProfile,
  useRebateTrades,
  useReferralConfig,
} from "../hooks";
import { formatMicroUsd } from "../api";

const CARD_STYLE: React.CSSProperties = {
  border: "1px solid rgba(39,39,42,1)",
  background: "rgba(24,24,27,1)",
  borderRadius: 16,
};

const ACCENT = "#c7ff2e";

function buildInviteLink(code: string): string {
  if (typeof window === "undefined") return `?invite=${code}`;
  return `${window.location.origin}/?invite=${encodeURIComponent(code)}`;
}

export function ReferralPage() {
  const { t } = useTranslation();
  const tr = useCallback(
    (key: string, fallback: string, opts?: Record<string, unknown>) => {
      const val = (t as (k: string, o?: Record<string, unknown>) => string)(key, opts);
      return val === key ? fallback : val;
    },
    [t],
  );

  const { status, signIn } = useAuth();
  const { evmAddress } = usePredictWallet();
  const isAuthenticated = status === "authenticated" && Boolean(evmAddress);
  const eoa = evmAddress || undefined;

  const { data: config } = useReferralConfig();
  const { data: inviteCode } = useInviteCode(eoa);
  const { data: profile } = useRebateProfile(eoa);
  const { data: invitees } = useInvitees(eoa);
  const { data: trades } = useRebateTrades(eoa);
  const claim = useClaimRebate(eoa);

  const [tab, setTab] = useState<"invited" | "trades">("invited");

  const ratioPct = useMemo(() => {
    const r = config?.commission_ratio ?? inviteCode?.rebate_ratio ?? 0;
    return Math.round(r * 100);
  }, [config?.commission_ratio, inviteCode?.rebate_ratio]);

  const inviteLink = inviteCode?.invite_code ? buildInviteLink(inviteCode.invite_code) : "";

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold text-zinc-100">
          {tr("extend.referral.title", "Referral Rewards")}
        </h1>
        <p className="text-sm text-zinc-400">
          {tr("extend.referral.signInPrompt", "Sign in to view your referral rewards.")}
        </p>
        <button
          type="button"
          onClick={signIn}
          className="rounded-[10px] border border-[#c7ff2e]/25 bg-[#c7ff2e]/10 px-4 py-2 text-sm font-semibold text-[#c7ff2e] transition-colors hover:bg-[#c7ff2e]/20"
        >
          {tr("common.signIn", "Sign In")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 lg:pb-6">
      {/* Top commission-rate bar */}
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={CARD_STYLE}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold" style={{ color: ACCENT }}>
            {ratioPct}%
          </span>
          <span className="text-sm text-zinc-400">
            {tr("extend.referral.commissionRate", "Commission Rate")}
          </span>
        </div>
        <span className="text-xs text-zinc-500">
          {tr(
            "extend.referral.commissionHint",
            "Earn a share of builder fees from every trade your invitees make.",
          )}
        </span>
      </div>

      {/* Main reflow container */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Left column (reward cards + tabs + list) — desktop order 1 */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:order-1">
          {/* Three reward cards */}
          <div className="flex flex-col gap-3 lg:flex-row">
            <RewardCard
              label={tr("extend.referral.totalReward", "Total Rewards")}
              value={formatMicroUsd(profile?.total_amount)}
            />
            <PendingRewardCard
              label={tr("extend.referral.pendingReward", "Claimable")}
              value={formatMicroUsd(profile?.free_amount)}
              lockedValue={formatMicroUsd(profile?.lock_amount)}
              lockedLabel={tr("extend.referral.locked", "Locked")}
              canClaim={Boolean(profile?.can_claim)}
              claiming={claim.isPending}
              onClaim={() => claim.mutate()}
              claimLabel={tr("extend.referral.claim", "Claim")}
              claimingLabel={tr("extend.referral.claiming", "Claiming…")}
              minHint={tr("extend.referral.minClaimHint", "Min {{amount}} to claim", {
                amount: formatMicroUsd(profile?.min_claim_amount),
              })}
            />
            <RewardCard
              label={tr("extend.referral.claimedReward", "Claimed")}
              value={formatMicroUsd(profile?.claimed_amount)}
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-5 border-b border-[rgba(39,39,42,1)] px-1">
            <TabButton
              active={tab === "invited"}
              onClick={() => setTab("invited")}
              label={tr("extend.referral.tabInvited", "Recent Invited")}
            />
            <TabButton
              active={tab === "trades"}
              onClick={() => setTab("trades")}
              label={tr("extend.referral.tabTrades", "Trade Records")}
            />
          </div>

          {/* List */}
          <div className="overflow-auto lg:overflow-hidden" style={CARD_STYLE}>
            {tab === "invited" ? (
              <InviteesList
                rows={invitees ?? []}
                tr={tr}
              />
            ) : (
              <TradesList rows={trades ?? []} tr={tr} />
            )}
          </div>
        </div>

        {/* Right column (invite card) — desktop order 2, fixed width */}
        <div className="w-full lg:order-2 lg:w-[360px] lg:shrink-0">
          <InviteCard
            inviteCode={inviteCode?.invite_code ?? ""}
            inviteLink={inviteLink}
            invitedCount={invitees?.length ?? 0}
            tr={tr}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reward cards
// ---------------------------------------------------------------------------

function RewardCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 px-4 py-4" style={CARD_STYLE}>
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xl font-semibold tabular-nums text-zinc-100">{value}</span>
    </div>
  );
}

function PendingRewardCard({
  label,
  value,
  lockedValue,
  lockedLabel,
  canClaim,
  claiming,
  onClaim,
  claimLabel,
  claimingLabel,
  minHint,
}: {
  label: string;
  value: string;
  lockedValue: string;
  lockedLabel: string;
  canClaim: boolean;
  claiming: boolean;
  onClaim: () => void;
  claimLabel: string;
  claimingLabel: string;
  minHint: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2 px-4 py-4" style={CARD_STYLE}>
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xl font-semibold tabular-nums" style={{ color: ACCENT }}>
        {value}
      </span>
      <span className="text-[11px] text-zinc-500">
        {lockedLabel}: <span className="tabular-nums text-zinc-400">{lockedValue}</span>
      </span>
      <button
        type="button"
        disabled={!canClaim || claiming}
        onClick={onClaim}
        className={cn(
          "mt-1 rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors",
          canClaim && !claiming
            ? "cursor-pointer bg-[#c7ff2e]/10 text-[#c7ff2e] hover:bg-[#c7ff2e]/20"
            : "cursor-not-allowed bg-zinc-800/60 text-zinc-500",
        )}
      >
        {claiming ? claimingLabel : claimLabel}
      </button>
      {!canClaim && <span className="text-[10px] text-zinc-600">{minHint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={cn(
        "-mb-px border-b-2 px-1 py-2 text-sm font-medium transition-colors",
        active
          ? "border-[#c7ff2e] text-[#c7ff2e]"
          : "border-transparent text-zinc-500 hover:text-zinc-300",
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

type Tr = (key: string, fallback: string, opts?: Record<string, unknown>) => string;

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function InviteesList({
  rows,
  tr,
}: {
  rows: {
    invitee_eoa: string;
    invite_code: string;
    joined_at: string;
    total_trade_amount: number;
    total_rebate_amount: number;
  }[];
  tr: Tr;
}) {
  if (rows.length === 0) {
    return <EmptyRow text={tr("extend.referral.noInvitees", "No invitees yet")} />;
  }
  return (
    <div className="min-w-[560px] lg:min-w-0">
      <div className="flex items-center justify-between border-b border-[rgba(39,39,42,1)] px-4 py-2.5 text-[11px] uppercase tracking-wide text-zinc-500">
        <span className="w-[180px] shrink-0">{tr("extend.referral.colUser", "User")}</span>
        <span className="flex-1 text-right">{tr("extend.referral.colTradeVol", "Trade Volume")}</span>
        <span className="flex-1 text-right">{tr("extend.referral.colRebate", "Rebate")}</span>
        <span className="w-[120px] shrink-0 text-right">
          {tr("extend.referral.colJoined", "Joined")}
        </span>
      </div>
      {rows.map((r) => (
        <div
          key={r.invitee_eoa}
          className="flex items-center justify-between px-4 py-3 text-sm hover:bg-[rgba(39,39,42,0.4)]"
        >
          <span className="w-[180px] shrink-0 font-medium text-zinc-200">
            {truncateAddress(r.invitee_eoa)}
          </span>
          <span className="flex-1 text-right tabular-nums text-zinc-300">
            {formatMicroUsd(r.total_trade_amount)}
          </span>
          <span className="flex-1 text-right tabular-nums" style={{ color: ACCENT }}>
            {formatMicroUsd(r.total_rebate_amount)}
          </span>
          <span className="w-[120px] shrink-0 text-right text-xs text-zinc-500">
            {formatDate(r.joined_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TradesList({
  rows,
  tr,
}: {
  rows: {
    invitee_eoa: string;
    source_trade_id: string;
    trade_amount: number;
    rebate_amount: number;
    status: string;
    created_at: string;
  }[];
  tr: Tr;
}) {
  if (rows.length === 0) {
    return <EmptyRow text={tr("extend.referral.noTrades", "No rebate records yet")} />;
  }
  return (
    <div className="min-w-[560px] lg:min-w-0">
      <div className="flex items-center justify-between border-b border-[rgba(39,39,42,1)] px-4 py-2.5 text-[11px] uppercase tracking-wide text-zinc-500">
        <span className="w-[180px] shrink-0">{tr("extend.referral.colUser", "User")}</span>
        <span className="flex-1 text-right">{tr("extend.referral.colTradeAmount", "Trade")}</span>
        <span className="flex-1 text-right">{tr("extend.referral.colRebate", "Rebate")}</span>
        <span className="w-[120px] shrink-0 text-right">{tr("extend.referral.colTime", "Time")}</span>
      </div>
      {rows.map((r) => (
        <div
          key={`${r.source_trade_id}`}
          className="flex items-center justify-between px-4 py-3 text-sm hover:bg-[rgba(39,39,42,0.4)]"
        >
          <span className="w-[180px] shrink-0 font-medium text-zinc-200">
            {truncateAddress(r.invitee_eoa)}
          </span>
          <span className="flex-1 text-right tabular-nums text-zinc-300">
            {formatMicroUsd(r.trade_amount)}
          </span>
          <span className="flex-1 text-right tabular-nums" style={{ color: ACCENT }}>
            {formatMicroUsd(r.rebate_amount)}
          </span>
          <span className="w-[120px] shrink-0 text-right text-xs text-zinc-500">
            {formatDate(r.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="px-4 py-10 text-center text-sm text-zinc-500">{text}</div>;
}

// ---------------------------------------------------------------------------
// Invite card
// ---------------------------------------------------------------------------

function InviteCard({
  inviteCode,
  inviteLink,
  invitedCount,
  tr,
}: {
  inviteCode: string;
  inviteLink: string;
  invitedCount: number;
  tr: Tr;
}) {
  const { isMobile } = useScreen();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [inviteLink]);

  const handleShare = useCallback(async () => {
    if (!inviteLink) return;
    if (isMobile && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: tr("extend.referral.shareTitle", "Join me on Liberfi"),
          text: tr("extend.referral.shareText", "Trade prediction markets with me on Liberfi."),
          url: inviteLink,
        });
        return;
      } catch {
        // user cancelled or unsupported — fall through to copy
      }
    }
    await handleCopy();
  }, [inviteLink, isMobile, tr, handleCopy]);

  return (
    <div className="flex flex-col gap-4 px-5 py-5" style={CARD_STYLE}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-100">
          {tr("extend.referral.inviteTitle", "Invite Friends")}
        </span>
        <span className="text-xs text-zinc-500">
          {tr("extend.referral.invitedCount", "{{n}} invited", { n: invitedCount })}
        </span>
      </div>

      <div>
        <span className="text-xs text-zinc-500">
          {tr("extend.referral.inviteCode", "Invite Code")}
        </span>
        <div
          className="mt-1 rounded-[10px] px-3 py-2.5 text-center text-lg font-bold tracking-widest text-zinc-100"
          style={{ background: "rgba(39,39,42,0.5)" }}
        >
          {inviteCode || "—"}
        </div>
      </div>

      <div>
        <span className="text-xs text-zinc-500">
          {tr("extend.referral.inviteLink", "Invite Link")}
        </span>
        <div
          className="mt-1 flex items-center gap-2 rounded-[10px] px-3 py-2"
          style={{ background: "rgba(39,39,42,0.5)" }}
        >
          <span className="flex-1 truncate text-xs text-zinc-400">{inviteLink || "—"}</span>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!inviteLink}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {copied ? tr("extend.referral.copied", "Copied") : tr("extend.referral.copy", "Copy")}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleShare}
        disabled={!inviteLink}
        className="rounded-[10px] bg-[#c7ff2e]/10 px-4 py-2.5 text-sm font-semibold text-[#c7ff2e] transition-colors hover:bg-[#c7ff2e]/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {tr("extend.referral.share", "Share Invite Link")}
      </button>
    </div>
  );
}
