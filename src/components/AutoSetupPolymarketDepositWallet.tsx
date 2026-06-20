"use client";

import { useEffect, useRef } from "react";
import { useSetAtom } from "jotai";
import { usePredictWallet } from "@liberfi.io/ui-predict";
import { useAuth, useWallets } from "@liberfi.io/wallet-connector";
import { usePolymarketDeployAndApprove } from "../lib/usePolymarketDeployAndApprove";
import { polymarketAutoSetupPendingAtom } from "../lib/polymarketAutoSetupState";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

function isTransientAutoSetupError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("evm wallet not connected") ||
    message.includes("cannot get eip-1193 provider") ||
    message.includes("wallet status is still loading")
  );
}

/**
 * Runs the post-login Polymarket deposit wallet setup for embedded wallets.
 * The approval step signs typed data, so a no-popup experience depends on the
 * connected wallet adapter supporting silent Polygon switching and signing.
 */
export function AutoSetupPolymarketDepositWallet() {
  const { status } = useAuth();
  const wallets = useWallets();
  const {
    evmAddress,
    polymarketSetupLoading,
    polymarketSetupVerified,
    polymarketWalletKind,
  } = usePredictWallet();
  const setupPolymarketWallet = usePolymarketDeployAndApprove();
  const setAutoSetupPending = useSetAtom(polymarketAutoSetupPendingAtom);
  const attemptedAddresses = useRef<Set<string>>(new Set());
  const inFlight = useRef(false);

  const evmWalletConnected = wallets.some(
    (wallet) => wallet.chainNamespace === "EVM" && wallet.isConnected,
  );

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !evmAddress ||
      !evmWalletConnected ||
      polymarketSetupLoading ||
      polymarketSetupVerified ||
      polymarketWalletKind === "safe" ||
      attemptedAddresses.current.has(evmAddress) ||
      inFlight.current
    ) {
      return;
    }

    inFlight.current = true;
    setAutoSetupPending(true);

    void setupPolymarketWallet()
      .then(() => {
        attemptedAddresses.current.add(evmAddress);
      })
      .catch((error: unknown) => {
        if (!isTransientAutoSetupError(error)) {
          attemptedAddresses.current.add(evmAddress);
        }
        console.warn("[polymarket] auto setup deposit wallet failed", error);
      })
      .finally(() => {
        inFlight.current = false;
        setAutoSetupPending(false);
      });
  }, [
    status,
    evmAddress,
    evmWalletConnected,
    polymarketSetupLoading,
    polymarketSetupVerified,
    polymarketWalletKind,
    setupPolymarketWallet,
    setAutoSetupPending,
  ]);

  return null;
}
