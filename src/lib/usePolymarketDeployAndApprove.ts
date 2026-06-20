import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDeployPolymarketDepositWallet,
  polymarketSetupQueryKey,
} from "@liberfi.io/react-predict";
import { usePredictWallet } from "@liberfi.io/ui-predict";
import {
  useWallets,
  type EvmWalletAdapter,
} from "@liberfi.io/wallet-connector";
import { createWalletClient, custom, type Hex } from "viem";
import { polygon } from "viem/chains";
import {
  deploySafe,
  executeSafe,
  executeDepositWalletBatch,
  buildAllApprovalTxns,
  buildAllDepositApprovalCalls,
  pollTransaction,
  type PolymarketRelayConfig,
} from "./polymarket-relay";

/**
 * Shared Polymarket deploy + approve orchestration used by every "set up
 * account" entry point (header balance dropdown, fund-wallet modal, trade-form
 * setup modal) so they all run the identical on-chain flow.
 *
 * Deposit-wallet model: gasless server-side WALLET-CREATE (no signature) then a
 * single WALLET batch granting pUSD + CTF approvals. Legacy Safe model:
 * deploy-signature + approval-signature via the relay.
 */
export function usePolymarketDeployAndApprove(): () => Promise<void> {
  const {
    evmAddress,
    polymarketWalletKind,
    polymarketWalletDeployed,
    polymarketDepositWalletAddress,
    polymarketTokenApproved,
    polymarketSetupLoading,
  } = usePredictWallet();

  const wallets = useWallets();
  const queryClient = useQueryClient();
  const deployDepositWallet = useDeployPolymarketDepositWallet(evmAddress);

  // Only the explicit legacy `safe` kind takes the Gnosis Safe path; any other
  // value (including an unresolved status) defaults to the deposit-wallet model
  // so a brand-new EOA never accidentally deploys a Safe.
  const isDepositWallet = polymarketWalletKind !== "safe";

  const relayConfig: PolymarketRelayConfig = useMemo(
    () => ({ signProxyUrl: "/predict-api/api/v1/polymarket/sign" }),
    [],
  );

  return useCallback(async () => {
    // Hard gate: never deploy before the authoritative Polymarket setup status
    // resolves, otherwise we could deploy the wrong wallet type for the EOA.
    if (polymarketSetupLoading) {
      throw new Error("Wallet status is still loading, please try again");
    }

    const evmWallet = wallets.find(
      (w) => w.chainNamespace === "EVM" && w.isConnected,
    ) as EvmWalletAdapter | undefined;
    if (!evmWallet || !evmAddress) {
      throw new Error("EVM wallet not connected");
    }

    if (polymarketWalletDeployed && polymarketTokenApproved) {
      return;
    }

    await evmWallet.switchChain("137" as never);

    const provider = await evmWallet.getEip1193Provider();
    if (!provider) throw new Error("Cannot get EIP-1193 provider");

    const walletClient = createWalletClient({
      account: evmAddress as Hex,
      chain: polygon,
      transport: custom(provider),
    });

    if (isDepositWallet) {
      let depositWalletAddress = polymarketDepositWalletAddress;
      if (!polymarketWalletDeployed) {
        const deployResult = await deployDepositWallet.mutateAsync(evmAddress);
        depositWalletAddress =
          deployResult.deposit_wallet_address ?? depositWalletAddress;
      }
      if (!depositWalletAddress) {
        throw new Error("deposit wallet address unavailable");
      }

      if (!polymarketTokenApproved) {
        const approvalCalls = buildAllDepositApprovalCalls();
        const approveResult = await executeDepositWalletBatch(
          walletClient,
          depositWalletAddress as Hex,
          approvalCalls,
          relayConfig,
        );
        if (approveResult.transactionID) {
          await pollTransaction(relayConfig, approveResult.transactionID);
        }
      }

      queryClient.invalidateQueries({
        queryKey: polymarketSetupQueryKey(evmAddress),
      });
      return;
    }

    // Legacy Safe path (signatureType=2, USDC.e, V1 exchanges).
    if (!polymarketWalletDeployed) {
      const deployResult = await deploySafe(walletClient, relayConfig);
      if (deployResult.transactionID) {
        await pollTransaction(relayConfig, deployResult.transactionID);
      }
    }

    if (!polymarketTokenApproved) {
      const approvalTxns = buildAllApprovalTxns();
      const approveResult = await executeSafe(
        walletClient,
        approvalTxns,
        relayConfig,
      );
      if (approveResult.transactionID) {
        await pollTransaction(relayConfig, approveResult.transactionID);
      }
    }

    queryClient.invalidateQueries({
      queryKey: polymarketSetupQueryKey(evmAddress),
    });
  }, [
    wallets,
    evmAddress,
    isDepositWallet,
    polymarketSetupLoading,
    polymarketWalletDeployed,
    polymarketDepositWalletAddress,
    polymarketTokenApproved,
    deployDepositWallet,
    relayConfig,
    queryClient,
  ]);
}
