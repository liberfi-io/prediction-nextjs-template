"use client";

import { useEffect, useMemo } from "react";
import { ChainNamespace } from "@liberfi.io/types";

interface WalletLike {
  address?: string;
  chainNamespace: ChainNamespace;
  isConnected: boolean;
}

interface UsePrivySessionSignerProvisioningInput {
  enabled: boolean;
  storagePrefix: string;
  userId?: string;
  wallets: WalletLike[];
  chainNamespaces?: ChainNamespace[];
  addSigners: (input: {
    address: string;
    signers: Array<{ signerId: string; policyIds?: string[] }>;
  }) => Promise<unknown>;
}

function parsePolicyIds(value: string | undefined): string[] | undefined {
  const policyIds = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return policyIds?.length ? policyIds : undefined;
}

function getStorageKey(
  storagePrefix: string,
  chainNamespace: ChainNamespace,
  userId: string,
  address: string,
  signerId: string,
) {
  return `${storagePrefix}:${chainNamespace}:${userId}:${address}:${signerId}`;
}

export function usePrivySessionSignerProvisioning({
  enabled,
  storagePrefix,
  userId,
  wallets,
  chainNamespaces = [ChainNamespace.EVM, ChainNamespace.SOLANA],
  addSigners,
}: UsePrivySessionSignerProvisioningInput) {
  const signerId = process.env.NEXT_PUBLIC_PRIVY_SESSION_SIGNER_ID;
  const policyIds = useMemo(
    () => parsePolicyIds(process.env.NEXT_PUBLIC_PRIVY_SESSION_SIGNER_POLICY_IDS),
    [],
  );

  useEffect(() => {
    if (!enabled || !userId || !signerId) return;

    let cancelled = false;
    const connectedWallets = wallets.filter(
      (wallet) =>
        wallet.isConnected &&
        wallet.address &&
        chainNamespaces.includes(wallet.chainNamespace),
    );

    for (const wallet of connectedWallets) {
      const address = wallet.address;
      if (!address) continue;

      const key = getStorageKey(
        storagePrefix,
        wallet.chainNamespace,
        userId,
        address,
        signerId,
      );
      if (localStorage.getItem(key) === "done") continue;

      void addSigners({
        address,
        signers: [{ signerId, policyIds }],
      })
        .then(() => {
          if (!cancelled) localStorage.setItem(key, "done");
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          if (/already|exists|duplicate/i.test(message)) {
            localStorage.setItem(key, "done");
            return;
          }
          console.warn("privy session signer provisioning failed", {
            address,
            chainNamespace: wallet.chainNamespace,
            message,
          });
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    addSigners,
    chainNamespaces,
    enabled,
    policyIds,
    signerId,
    storagePrefix,
    userId,
    wallets,
  ]);
}
