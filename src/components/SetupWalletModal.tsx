"use client";

import { usePredictWallet, SetupModal } from "@liberfi.io/ui-predict";
import {
  AsyncModal,
  type RenderAsyncModalProps,
} from "@liberfi.io/ui-scaffold";
import { usePolymarketDeployAndApprove } from "../lib/usePolymarketDeployAndApprove";

export const SETUP_WALLET_MODAL_ID = "setup-polymarket-wallet";

/**
 * Globally-mounted Polymarket "set up account" modal. Any entry point (trade
 * form CTA, list / detail / world-cup pages) opens the identical setup +
 * approve flow used by the header balance dropdown via:
 *
 *   useAsyncModal(SETUP_WALLET_MODAL_ID).onOpen()
 */
export function SetupWalletModal() {
  return (
    <AsyncModal id={SETUP_WALLET_MODAL_ID}>
      {(props: RenderAsyncModalProps) => (
        <SetupWalletBody isOpen={props.isOpen} onClose={props.onClose} />
      )}
    </AsyncModal>
  );
}

function SetupWalletBody({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    evmAddress,
    polymarketWalletKind,
    polymarketWalletDeployed,
    polymarketTokenApproved,
  } = usePredictWallet();
  const handleDeployAndApprove = usePolymarketDeployAndApprove();

  if (!evmAddress) return null;

  return (
    <SetupModal
      isOpen={isOpen}
      onClose={onClose}
      evmAddress={evmAddress}
      walletKind={polymarketWalletKind}
      safeDeployed={polymarketWalletDeployed}
      tokenApproved={polymarketTokenApproved}
      onDeployAndApprove={handleDeployAndApprove}
    />
  );
}
