"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "@liberfi.io/i18n";
import type {
  PredictEvent,
  PredictMarket,
  PredictPosition,
  PolymarketTypedData,
} from "@liberfi.io/react-predict";
import {
  useRedeemPosition,
  useTradeResultConfirmation,
} from "@liberfi.io/react-predict";
import { ChainNamespace } from "@liberfi.io/types";
import { Button, ModalContent, Spinner, StyledModal, useScreen } from "@liberfi.io/ui";
import { AsyncModal, type RenderAsyncModalProps } from "@liberfi.io/ui-scaffold";
import { useAuthCallback, useWallets, type EvmWalletAdapter } from "@liberfi.io/wallet-connector";
import { PREDICT_REDEEM_MODAL_ID, usePredictWallet } from "@liberfi.io/ui-predict";

export type RedeemOutcome = "yes" | "no";

export type RedeemDisplayParams = {
  title?: string;
  marketLabel?: string;
  sideLabel?: string;
  outcome?: RedeemOutcome;
};

export type PredictRedeemModalParams = {
  event: PredictEvent;
  market: PredictMarket;
  position: PredictPosition;
  display?: RedeemDisplayParams;
};

type RedeemStatus = "idle" | "pending" | "confirming" | "success" | "delayed" | "error";

export function PredictRedeemModal({
  id = PREDICT_REDEEM_MODAL_ID,
}: {
  id?: string;
}) {
  return (
    <AsyncModal<PredictRedeemModalParams, void> id={id}>
      {(modalProps) => <PredictRedeemModalContent {...modalProps} />}
    </AsyncModal>
  );
}

function PredictRedeemModalContent({
  params,
  isOpen,
  onOpenChange,
}: RenderAsyncModalProps<PredictRedeemModalParams, void>) {
  const { t } = useTranslation();
  const { isMobile } = useScreen();

  if (!params) return null;

  return (
    <StyledModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size={isMobile ? "lg" : "md"}
      backdrop="opaque"
      hideCloseButton
      classNames={{
        base: "!bg-[#18181b] !rounded-[14px] !border !border-[rgba(39,39,42,1)] !shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
        body: "!p-0",
      }}
    >
      <ModalContent>
        <div className={isMobile ? "" : "p-2"}>
          <div className="px-4 pt-4 pb-1">
            <h3 className="text-lg font-semibold text-white">
              {t("extend.portfolio.redeem", { defaultValue: "Redeem" })}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              {t("extend.portfolio.redeemDescription", {
                defaultValue: "Redeem this position after settlement.",
              })}
            </p>
          </div>
          <RedeemForm
            event={params.event}
            market={params.market}
            position={params.position}
            display={params.display}
            onSuccess={() => {
              setTimeout(() => onOpenChange(false), 1500);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </ModalContent>
    </StyledModal>
  );
}

function RedeemForm({
  event,
  market,
  position,
  display,
  onSuccess,
  onCancel,
}: {
  event?: PredictEvent;
  market: PredictMarket;
  position: PredictPosition;
  display?: RedeemDisplayParams;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: redeem } = useRedeemPosition();
  const { start: confirmTradeResult } = useTradeResultConfirmation();
  const { evmAddress } = usePredictWallet();
  const wallets = useWallets();
  const [status, setStatus] = useState<RedeemStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const conditionId = market.provider_meta?.["polymarket.conditionId"] as string | undefined;
  const negRisk = (market.provider_meta?.["polymarket.negRisk"] as boolean | undefined) ?? false;
  const walletAddress = evmAddress ?? "";
  const evmWallet = useMemo(
    () =>
      wallets.find(
        (wallet) => wallet.chainNamespace === ChainNamespace.EVM && wallet.isConnected,
      ) as EvmWalletAdapter | undefined,
    [wallets],
  );

  const positionOutcome = display?.outcome ?? resolveOutcome(position.side, market.outcomes) ?? "no";
  const winningOutcome = resolveOutcome(market.result ?? "", market.outcomes);
  const hasSettledResult = market.result != null && market.result !== "";
  const isWinner = hasSettledResult && winningOutcome ? positionOutcome === winningOutcome : true;
  const settledPositionValue = finiteAmount(position.current_value);
  const expectedPayout = hasSettledResult
    ? isWinner ? position.size : 0
    : settledPositionValue ?? 0;
  const yesLabel = String(t("extend.worldcup.detail.trade.yes", { defaultValue: "Yes" }));
  const noLabel = String(t("extend.worldcup.detail.trade.no", { defaultValue: "No" }));
  const sideLabel = display?.sideLabel ?? outcomeLabel(positionOutcome, yesLabel, noLabel);
  const positionTitle = display?.title ?? event?.title ?? market.question;
  const positionSubtitle = display?.marketLabel;
  const winnerLabel =
    (winningOutcome ? outcomeLabel(winningOutcome, yesLabel, noLabel) : undefined) ??
    market.result ??
    "";

  const handleRedeem = useCallback(async () => {
    if (!conditionId || !walletAddress || !evmWallet) return;

    setStatus("pending");
    setErrorMessage(null);

    try {
      const provider = await evmWallet.getEip1193Provider();
      if (!provider) throw new Error("EIP-1193 provider unavailable");

      await redeem({
        wallet_address: walletAddress,
        condition_id: conditionId,
        neg_risk: negRisk,
        signMessage: async (messageHash: string) =>
          (await provider.request({
            method: "personal_sign",
            params: [messageHash, walletAddress],
          })) as string,
        signTypedData: async (typedData: PolymarketTypedData) =>
          (await provider.request({
            method: "eth_signTypedData_v4",
            params: [walletAddress, JSON.stringify(typedData)],
          })) as string,
      });

      setStatus("confirming");
      const result = await confirmTradeResult({
        source: position.source,
        user: walletAddress,
        marketSlug: position.market?.slug ?? market.slug,
        eventSlug: position.event?.slug ?? event?.slug,
        expectation: "redeem",
        expectedPayout,
      } as Parameters<typeof confirmTradeResult>[0] & { expectedPayout: number });
      setStatus(result === "confirmed" ? "success" : "delayed");
      onSuccess?.();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : t("predict.redeem.error"));
    }
  }, [
    conditionId,
    walletAddress,
    evmWallet,
    redeem,
    negRisk,
    confirmTradeResult,
    position.source,
    position.market?.slug,
    position.event?.slug,
    market.slug,
    event?.slug,
    expectedPayout,
    onSuccess,
    t,
  ]);

  const authenticatedRedeem = useAuthCallback(handleRedeem);
  const canRedeem =
    status === "idle" && Boolean(conditionId && walletAddress && evmWallet && position.redeemable);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2 rounded-xl bg-[rgba(39,39,42,0.4)] p-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-base font-medium text-white">
            {positionTitle}
          </div>
          {(positionSubtitle || sideLabel) && (
            <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-zinc-400">
              {positionSubtitle && (
                <span className="min-w-0 truncate">{positionSubtitle}</span>
              )}
              {positionSubtitle && sideLabel && (
                <span className="shrink-0 text-zinc-600">&bull;</span>
              )}
              {sideLabel && (
                <span className="shrink-0 font-medium text-bullish">
                  {sideLabel}
                </span>
              )}
            </div>
          )}
        </div>
        {hasSettledResult && winnerLabel && (
          <InfoRow
            label={t("predict.redeem.result")}
            value={winnerLabel}
            valueClassName="text-bullish"
          />
        )}
        <InfoRow
          label={t("extend.portfolio.redeemShares", { defaultValue: "Shares" })}
          value={formatShares(position.size)}
        />
        <InfoRow
          label={t("extend.portfolio.expectedRedeemAmount", {
            defaultValue: "Expected Amount",
          })}
          value={`$${expectedPayout.toFixed(2)}`}
          valueClassName={expectedPayout > 0 ? "text-bullish" : "text-zinc-400"}
        />
      </div>

      {expectedPayout <= 0 && (
        <p className="text-sm text-zinc-500">{t("predict.redeem.noWinnings")}</p>
      )}

      {status === "error" && errorMessage && (
        <p className="text-sm text-red-400">{errorMessage}</p>
      )}
      {status === "success" && (
        <p className="text-sm text-bullish">{t("predict.redeem.success")}</p>
      )}
      {status === "delayed" && (
        <p className="text-sm text-zinc-400">
          {t("predict.trade.resultDelayed", {
            defaultValue:
              "Your trade was submitted successfully. Confirmation is taking a little longer.",
          })}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {status !== "success" && status !== "delayed" && (
          <Button
            className="h-12 w-full rounded-xl bg-bullish text-sm font-semibold text-black hover:bg-bullish/90"
            isDisabled={!canRedeem}
            isLoading={status === "pending" || status === "confirming"}
            onPress={authenticatedRedeem}
            spinner={<Spinner size="sm" color="current" />}
          >
            {t("extend.portfolio.redeem", { defaultValue: "Redeem" })}
          </Button>
        )}

        {onCancel && status !== "success" && status !== "delayed" && (
          <button
            type="button"
            onClick={onCancel}
            className="h-12 w-full cursor-pointer rounded-xl text-sm font-medium text-zinc-400 transition-colors hover:bg-[rgba(39,39,42,0.5)] hover:text-white focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {t("common.cancel")}
          </button>
        )}

        {(status === "success" || status === "delayed") && onCancel && (
          <Button className="h-12 w-full rounded-xl text-sm font-medium" onPress={onCancel}>
            {t("common.ok")}
          </Button>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClassName = "text-white",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-sm text-zinc-400">{label}</span>
      <span className={`min-w-0 truncate text-right text-sm font-medium ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}

function resolveOutcome(
  side: string,
  outcomes: { label: string }[] | undefined,
): RedeemOutcome | undefined {
  const lower = side.trim().toLowerCase();
  if (lower === "yes" || lower === "over" || lower === "odd") return "yes";
  if (lower === "no" || lower === "under" || lower === "even") return "no";
  if (!outcomes) return undefined;
  const idx = outcomes.findIndex((outcome) => outcome.label.trim().toLowerCase() === lower);
  if (idx === 0) return "yes";
  if (idx === 1) return "no";
  return undefined;
}

function outcomeLabel(outcome: RedeemOutcome, yesLabel: string, noLabel: string): string {
  return outcome === "yes" ? yesLabel : noLabel;
}

function formatShares(size: number, maxDecimals = 2): string {
  const factor = Math.pow(10, maxDecimals);
  return parseFloat((Math.floor(size * factor) / factor).toFixed(maxDecimals)).toString();
}

function finiteAmount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
