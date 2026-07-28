"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@liberfi.io/i18n";
import { ChevronDownIcon, ChevronRightIcon, Spinner, cn } from "@liberfi.io/ui";
import type {
  PredictEvent,
  PredictMarket,
  ProviderSource,
} from "@liberfi.io/react-predict";
import { pickBestAsk, useRealtimeOrderbook } from "@liberfi.io/react-predict";
import {
  formatShares,
  KycModal,
  useTradeForm,
  type TradeOutcome,
} from "@liberfi.io/ui-predict";
import { useAuthCallback } from "@liberfi.io/wallet-connector";
import {
  clearWorldcupOrderbookPrice,
  publishWorldcupOrderbookPrice,
  useWorldcupOrderbookPrice,
} from "../../orderbookPriceStore";
import { getTradeDisplayLabels, withOutcomePrice } from "./TradePanel";

const QUICK_AMOUNTS = [1, 5, 10, 100] as const;
const EMPTY_VALUE = "-";

function floorUsd(value: number): number {
  return Math.floor(Math.max(0, value) * 100) / 100;
}

function formatUsd(value: number): string {
  return `$${floorUsd(value).toFixed(2)}`;
}

function parseAmountText(value: string): number {
  const normalized = value.replace(/^\$/, "");
  if (normalized === "" || normalized === ".") return NaN;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function amountDisplayText(value: number): string {
  return Number.isFinite(value) ? `$${value}` : "";
}

/**
 * Mobile-only simplified buy sheet for World Cup markets.
 *
 * The SDK hook still owns balances, signing and order submission. This component
 * only narrows the surface to one buy-focused flow.
 */
export function MobileBuyTradePanel({
  event,
  market,
  outcome = "yes",
  onInsufficientBalance,
  oddsFormatter,
  legacyOrderbookEnabled = true,
}: {
  event: PredictEvent;
  market: PredictMarket;
  outcome?: TradeOutcome;
  onInsufficientBalance?: (source: ProviderSource) => void;
  oddsFormatter?: (price: number) => string;
  legacyOrderbookEnabled?: boolean;
}) {
  const { t } = useTranslation();
  const sharedOutcomePrice = useWorldcupOrderbookPrice(market.slug, outcome);
  const { data: liveOrderbook } = useRealtimeOrderbook(
    {
      slug: market.slug,
      source: market.source ?? "polymarket",
      outcome,
    },
    { enabled: legacyOrderbookEnabled && market.status === "open" },
  );
  const hasLiveOutcomeBook =
    liveOrderbook?.market_id === market.slug &&
    liveOrderbook?.outcome === outcome;
  const liveOutcomePrice = useMemo(() => {
    if (!hasLiveOutcomeBook) {
      return null;
    }
    const ask = pickBestAsk(liveOrderbook, outcome);
    return ask != null && ask > 0 ? ask : null;
  }, [hasLiveOutcomeBook, liveOrderbook, outcome]);

  useEffect(() => {
    if (!hasLiveOutcomeBook) return;
    if (liveOutcomePrice == null || liveOutcomePrice <= 0) {
      clearWorldcupOrderbookPrice(market.slug, outcome);
      return;
    }
    publishWorldcupOrderbookPrice(market.slug, outcome, liveOutcomePrice);
  }, [hasLiveOutcomeBook, liveOutcomePrice, market.slug, outcome]);

  const effectiveMarket = useMemo(
    () => withOutcomePrice(market, outcome, sharedOutcomePrice),
    [market, outcome, sharedOutcomePrice],
  );
  const {
    outcome: activeOutcome,
    orderType,
    quantity,
    limitPrice,
    shares,
    estimatedCost,
    estimatedFee,
    potentialPayout,
    potentialProfit,
    pricePerShare,
    usdcBalance,
    maxBuyAmount,
    isBalanceLoading,
    isMarketDataLoading,
    isSubmitting,
    authStatus,
    validation,
    isInsufficientBalance,
    supportsLimitOrder,
    needsKyc,
    needsSetup,
    kycRequired,
    kycUrl,
    setOrderType,
    setQuantity,
    setLimitPrice,
    submit,
    notifyInsufficientBalance,
  } = useTradeForm({
    market: effectiveMarket,
    initialOutcome: outcome,
    onInsufficientBalance,
  });
  const authenticatedSubmit = useAuthCallback(submit);
  const [amountText, setAmountText] = useState("");
  const [limitPriceText, setLimitPriceText] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [oddsOpen, setOddsOpen] = useState(false);
  const [kycModalOpen, setKycModalOpen] = useState(false);
  const amountFocusedRef = useRef(false);
  const limitFocusedRef = useRef(false);

  const isAuthenticated = authStatus === "authenticated";
  const isAuthChecking =
    authStatus === "authenticating" || authStatus === "deauthenticating";
  const isPrerequisite = isAuthenticated && (needsKyc || needsSetup);
  const hasAmount = Number.isFinite(quantity) && quantity > 0;
  const eventTitle = event.title_trans || event.title;
  const { actionLabel, marketTitle, outcomeLabel } = useMemo(
    () =>
      getTradeDisplayLabels({
        market: effectiveMarket,
        outcome: activeOutcome,
        side: "buy",
        t,
      }),
    [activeOutcome, effectiveMarket, t],
  );
  const maxAmount = maxBuyAmount ?? floorUsd(usdcBalance ?? 0);
  const totalPayment = hasAmount ? estimatedCost + estimatedFee : 0;
  const effectivePriceWithFee =
    hasAmount && shares > 0 ? totalPayment / shares : 0;
  const effectiveOddsLabel =
    effectivePriceWithFee > 0
      ? (oddsFormatter?.(effectivePriceWithFee) ??
        `${Number.parseFloat((effectivePriceWithFee * 100).toFixed(2))}¢`)
      : EMPTY_VALUE;

  const visiblePrice =
    orderType === "limit" && Number.isFinite(limitPrice)
      ? limitPrice
      : pricePerShare;
  const priceLabel =
    Number.isFinite(visiblePrice) && visiblePrice > 0
      ? (oddsFormatter?.(visiblePrice) ??
        `${Number.parseFloat((visiblePrice * 100).toFixed(2))}¢`)
      : EMPTY_VALUE;

  useEffect(() => {
    if (!amountFocusedRef.current) {
      setAmountText(amountDisplayText(quantity));
    }
  }, [quantity]);

  useEffect(() => {
    if (limitFocusedRef.current) return;
    setLimitPriceText(
      Number.isFinite(limitPrice)
        ? String(Number.parseFloat((limitPrice * 100).toFixed(2)))
        : "",
    );
  }, [limitPrice]);

  const setAmount = useCallback(
    (value: number) => {
      const next = floorUsd(value);
      setAmountText(next > 0 ? amountDisplayText(next) : "");
      setQuantity(next > 0 ? next : NaN);
      setShowErrors(false);
    },
    [setQuantity],
  );

  const handleAmountInput = useCallback(
    (value: string) => {
      const normalized = value.replace(/^\$/, "");
      if (normalized !== "" && !/^\d*\.?\d{0,2}$/.test(normalized)) return;
      setAmountText(normalized ? `$${normalized}` : "");
      setQuantity(parseAmountText(value));
      setShowErrors(false);
    },
    [setQuantity],
  );

  const handleLimitPriceInput = useCallback(
    (value: string) => {
      if (value !== "" && !/^\d*\.?\d{0,2}$/.test(value)) return;
      setLimitPriceText(value);
      const parsed = parseAmountText(value);
      setLimitPrice(Number.isFinite(parsed) ? parsed / 100 : NaN);
      setShowErrors(false);
    },
    [setLimitPrice],
  );

  const handleQuickAmount = useCallback(
    (delta: number) => {
      const current = Number.isFinite(quantity) ? quantity : 0;
      const next =
        maxAmount > 0 ? Math.min(maxAmount, current + delta) : current + delta;
      setAmount(next);
    },
    [maxAmount, quantity, setAmount],
  );

  const handleMax = useCallback(() => {
    setAmount(maxAmount);
  }, [maxAmount, setAmount]);

  const handleSubmit = useCallback(() => {
    if (!isAuthenticated) {
      setShowErrors(false);
      authenticatedSubmit();
      return;
    }
    if ((needsSetup || isInsufficientBalance) && onInsufficientBalance) {
      setShowErrors(false);
      notifyInsufficientBalance();
      return;
    }
    if (needsKyc) {
      setKycModalOpen(true);
      return;
    }
    if (kycRequired) {
      setKycModalOpen(true);
      return;
    }
    if (!validation.isValid) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    authenticatedSubmit();
  }, [
    authenticatedSubmit,
    isAuthenticated,
    isInsufficientBalance,
    kycRequired,
    needsKyc,
    needsSetup,
    notifyInsufficientBalance,
    onInsufficientBalance,
    validation.isValid,
  ]);

  const buttonLabel = useMemo(() => {
    if (isAuthChecking) return t("extend.worldcup.detail.trade.checkingLogin");
    if (!isAuthenticated) return t("extend.worldcup.detail.trade.loginToTrade");
    if (needsKyc || kycRequired)
      return t("extend.worldcup.detail.trade.verify");
    if (needsSetup) return t("extend.worldcup.detail.trade.setup");
    if (isBalanceLoading)
      return t("extend.worldcup.detail.trade.loadingBalance");
    if (isMarketDataLoading)
      return t("extend.worldcup.detail.trade.loadingMarketData");
    if (isSubmitting) return t("extend.worldcup.detail.trade.submitting");
    if (!hasAmount) return t("extend.worldcup.detail.trade.enterAmount");
    if (hasAmount && potentialProfit > 0) {
      return t("extend.worldcup.detail.trade.winAmount", {
        amount: formatUsd(potentialProfit),
      });
    }
    return t("extend.worldcup.detail.trade.trade");
  }, [
    hasAmount,
    isAuthChecking,
    isAuthenticated,
    isBalanceLoading,
    isMarketDataLoading,
    isSubmitting,
    kycRequired,
    needsKyc,
    needsSetup,
    potentialProfit,
    t,
  ]);

  const submitDisabled =
    isAuthChecking ||
    (isAuthenticated &&
      !isPrerequisite &&
      (isBalanceLoading || isMarketDataLoading || !hasAmount || isSubmitting));
  const submitLoading =
    isAuthChecking ||
    (isAuthenticated &&
      !isPrerequisite &&
      (isSubmitting || isBalanceLoading || isMarketDataLoading));

  return (
    <>
      <div className="flex flex-col bg-[#18181b] px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 text-zinc-100">
        <div className="mx-auto mb-3 h-1 w-14 rounded-full bg-zinc-700" />
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-lg font-semibold text-white">
            {t("extend.worldcup.detail.trade.buy")}
          </span>
          <div
            className={cn(
              "flex items-center gap-0.5 rounded-[10px] bg-zinc-900/70 p-0.5",
              !supportsLimitOrder && "opacity-60",
            )}
          >
            {(["market", "limit"] as const).map((type) => (
              <button
                key={type}
                type="button"
                disabled={!supportsLimitOrder && type === "limit"}
                onClick={() => {
                  if (!supportsLimitOrder && type === "limit") return;
                  setOrderType(type);
                  setShowErrors(false);
                }}
                className={cn(
                  "rounded-[8px] px-2.5 py-1 text-xs font-medium transition-colors",
                  orderType === type
                    ? "bg-zinc-800 text-[#c7ff2e]"
                    : "text-zinc-500 hover:text-zinc-200",
                  !supportsLimitOrder && type === "limit"
                    ? "cursor-not-allowed"
                    : "cursor-pointer",
                )}
              >
                {t(`extend.worldcup.detail.trade.${type}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3 px-1 py-1">
          {event.image_url && (
            <img
              src={event.image_url}
              alt={String(eventTitle)}
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <span className="line-clamp-1 text-sm leading-tight text-zinc-500">
              {String(eventTitle)}
            </span>
            <span className="line-clamp-1 text-base font-semibold leading-tight">
              <span>{marketTitle} · </span>
              <span className="text-bullish">
                {actionLabel} {outcomeLabel}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-2 flex flex-col items-center px-1 py-2">
          <label className="sr-only" htmlFor="mobile-trade-amount">
            {t("extend.worldcup.detail.trade.amount")}
          </label>
          <div className="flex w-full items-center justify-center">
            <input
              id="mobile-trade-amount"
              value={amountText}
              inputMode="decimal"
              placeholder="$0"
              onChange={(event) => handleAmountInput(event.target.value)}
              onFocus={() => {
                amountFocusedRef.current = true;
              }}
              onBlur={() => {
                amountFocusedRef.current = false;
                setAmountText(amountDisplayText(quantity));
              }}
              className={cn(
                "min-w-0 max-w-[260px] bg-transparent text-center text-5xl font-semibold leading-none outline-none placeholder:text-zinc-500",
                hasAmount ? "text-zinc-100" : "text-zinc-400",
              )}
            />
          </div>

          {orderType === "limit" && supportsLimitOrder && (
            <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-zinc-900/60 px-3 py-2">
              <span className="text-sm font-medium text-zinc-500">
                {t("extend.worldcup.detail.trade.limit")}
              </span>
              <input
                value={limitPriceText}
                inputMode="decimal"
                placeholder="50"
                onChange={(event) => handleLimitPriceInput(event.target.value)}
                onFocus={() => {
                  limitFocusedRef.current = true;
                }}
                onBlur={() => {
                  limitFocusedRef.current = false;
                  setLimitPriceText(
                    Number.isFinite(limitPrice)
                      ? String(Number.parseFloat((limitPrice * 100).toFixed(2)))
                      : "",
                  );
                }}
                className="w-14 bg-transparent text-right text-sm font-semibold text-zinc-100 outline-none"
              />
              <span className="text-sm font-semibold text-zinc-500">¢</span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {QUICK_AMOUNTS.map((amount) => (
              <button
                type="button"
                key={amount}
                onClick={() => handleQuickAmount(amount)}
                className="rounded-full bg-content2 px-3 py-1 text-sm font-medium text-zinc-500 transition-colors hover:bg-content3 hover:text-zinc-100"
              >
                +${amount}
              </button>
            ))}
            <button
              type="button"
              onClick={handleMax}
              className="rounded-full bg-content2 px-3 py-1 text-sm font-medium text-zinc-500 transition-colors hover:bg-content3 hover:text-zinc-100"
            >
              {t("extend.worldcup.detail.trade.max")}
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between px-1 py-0.5 text-sm font-medium">
          <span className="text-zinc-400">
            {t("extend.worldcup.detail.trade.balance")}
          </span>
          <span className="font-semibold tabular-nums text-zinc-100">
            {usdcBalance != null ? formatUsd(usdcBalance) : "$0"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setOddsOpen((open) => !open)}
          className="flex items-center justify-between rounded-[10px] px-1 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <span>{t("extend.worldcup.detail.trade.odds")}</span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold tabular-nums text-zinc-100">
              {priceLabel}
            </span>
            {oddsOpen ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </span>
        </button>
        {oddsOpen && (
          <div className="mt-1 flex flex-col gap-y-1 px-1 pb-2 text-[13px] leading-5">
            <Metric
              label={t("predict.trade.numContracts")}
              value={shares > 0 ? formatShares(shares) : EMPTY_VALUE}
            />
            <Metric
              label={t("predict.trade.estFee")}
              value={estimatedFee > 0 ? formatUsd(estimatedFee) : EMPTY_VALUE}
            />
            <Metric
              label={t("predict.trade.totalPayment")}
              value={
                hasAmount && estimatedFee > 0
                  ? formatUsd(totalPayment)
                  : EMPTY_VALUE
              }
            />
            <Metric
              label={t("predict.trade.effectiveOdds")}
              value={estimatedFee > 0 ? effectiveOddsLabel : EMPTY_VALUE}
            />
            <Metric
              label={t("predict.trade.payout")}
              value={hasAmount ? formatUsd(potentialPayout) : EMPTY_VALUE}
            />
            <Metric
              label={t("predict.trade.estProfit")}
              value={
                hasAmount && potentialProfit > 0
                  ? `+${formatUsd(potentialProfit)}`
                  : EMPTY_VALUE
              }
              valueClassName={
                hasAmount && potentialProfit > 0 ? "text-bullish" : undefined
              }
            />
          </div>
        )}

        {showErrors && validation.errors.length > 0 && (
          <div className="mt-3 flex flex-col gap-1 rounded-[10px] border border-danger/20 bg-danger/10 px-3 py-2">
            {validation.errors.map((error) => (
              <span key={error} className="text-xs text-danger">
                {error}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitDisabled}
          className="mt-4 flex h-12 w-full shrink-0 items-center justify-center rounded-[10px] bg-[#c7ff2e] text-base font-semibold text-zinc-950 transition-colors hover:bg-[#d6ff63] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitLoading && <Spinner size="sm" color="current" />}
          <span className={cn(submitLoading && "ml-2")}>{buttonLabel}</span>
        </button>
      </div>

      <KycModal
        isOpen={kycModalOpen}
        onClose={() => setKycModalOpen(false)}
        kycUrl={kycUrl}
      />
    </>
  );
}

function Metric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums text-zinc-100",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}
