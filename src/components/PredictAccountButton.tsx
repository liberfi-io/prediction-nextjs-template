"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useTranslation,
} from "@liberfi.io/i18n";
import { useAuth, useWallets, type EvmWalletAdapter } from "@liberfi.io/wallet-connector";
import { usePredictWallet, KycModal, SetupModal } from "@liberfi.io/ui-predict";
import { dflowKYCQueryKey, polymarketSetupQueryKey } from "@liberfi.io/react-predict";
import { truncateAddress } from "@liberfi.io/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  Spinner,
  SignInIcon,
  SolanaIcon,
  PolygonIcon,
  cn,
} from "@liberfi.io/ui";
import { createWalletClient, custom, type Hex } from "viem";
import { polygon } from "viem/chains";
import {
  deploySafe,
  executeSafe,
  buildAllApprovalTxns,
  pollTransaction,
  type PolymarketRelayConfig,
} from "../lib/polymarket-relay";

function formatUsdc(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function GradientAvatar({
  seed,
  size = 32,
  className,
}: {
  seed?: string;
  size?: number;
  className?: string;
}) {
  const hash = seed
    ? seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    : 0;
  const c1 = `hsl(${(hash * 37) % 360}, 70%, 60%)`;
  const c2 = `hsl(${(hash * 73) % 360}, 65%, 45%)`;
  const c3 = `hsl(${(hash * 113) % 360}, 75%, 55%)`;

  return (
    <div
      className={cn("rounded-lg shadow-inner flex-shrink-0", className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`,
      }}
    />
  );
}


function WalletEntry({
  address,
  balance,
  chainName,
  chainIcon,
  trailing,
  balancePlaceholder,
}: {
  address?: string;
  balance: number | null;
  chainName: string;
  chainIcon: React.ReactNode;
  trailing?: React.ReactNode;
  balancePlaceholder?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!address) return;
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [address],
  );

  return (
    <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-[rgba(39,39,42,0.5)] transition-all">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800">
        {chainIcon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-300 truncate">
            {address ? truncateAddress(address) : "—"}
          </span>
          {address && (
            <button
              type="button"
              className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors cursor-pointer"
              title="Copy Address"
              onClick={handleCopy}
            >
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              )}
            </button>
          )}
          {trailing}
        </div>
        <div className="flex items-center gap-1.5 text-xs mt-0.5">
          {balancePlaceholder ?? (
            <>
              <span className="text-white font-medium">
                ${formatUsdc(balance ?? 0)}
              </span>
              <span className="text-zinc-500">USDC · {chainName}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function PredictAccountButton() {
  const { t } = useTranslation();
  const { status, signIn, signOut } = useAuth();
  const {
    kalshiUsdcBalance,
    polymarketUsdcBalance,
    evmAddress,
    solanaAddress,
    kalshiKycVerified,
    kalshiKycUrl,
    kalshiKycLoading,
    polymarketSetupVerified,
    polymarketSafeDeployed,
    polymarketTokenApproved,
    polymarketSetupLoading,
  } = usePredictWallet();
  const queryClient = useQueryClient();
  const wallets = useWallets();
  const [isOpen, setIsOpen] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isKycRefreshing, setIsKycRefreshing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayAddress = solanaAddress || evmAddress || "";

  const relayConfig: PolymarketRelayConfig = useMemo(
    () => ({ signProxyUrl: "/predict-api/api/v1/polymarket/sign" }),
    [],
  );

  const handleDeployAndApprove = useCallback(async () => {
    const evmWallet = wallets.find(
      (w) => w.chainNamespace === "EVM" && w.isConnected,
    ) as EvmWalletAdapter | undefined;
    if (!evmWallet || !evmAddress) {
      throw new Error("EVM wallet not connected");
    }

    await evmWallet.switchChain("137" as never);

    const provider = await evmWallet.getEip1193Provider();
    if (!provider) throw new Error("Cannot get EIP-1193 provider");

    const walletClient = createWalletClient({
      account: evmAddress as Hex,
      chain: polygon,
      transport: custom(provider),
    });

    if (!polymarketSafeDeployed) {
      const deployResult = await deploySafe(walletClient, relayConfig);
      if (deployResult.transactionID) {
        await pollTransaction(relayConfig, deployResult.transactionID);
      }
    }

    if (!polymarketTokenApproved) {
      const approvalTxns = buildAllApprovalTxns();
      const approveResult = await executeSafe(walletClient, approvalTxns, relayConfig);
      if (approveResult.transactionID) {
        await pollTransaction(relayConfig, approveResult.transactionID);
      }
    }

    queryClient.invalidateQueries({
      queryKey: polymarketSetupQueryKey(evmAddress),
    });
  }, [wallets, evmAddress, polymarketSafeDeployed, polymarketTokenApproved, relayConfig, queryClient]);

  const handleMouseEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setIsOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setIsOpen(false), 150);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    setIsOpen(false);
    await signOut();
  }, [signOut]);

  const handleKycRefresh = useCallback(async () => {
    if (!solanaAddress) return;
    setIsKycRefreshing(true);
    await queryClient.invalidateQueries({
      queryKey: dflowKYCQueryKey(solanaAddress),
    });
    setIsKycRefreshing(false);
  }, [queryClient, solanaAddress]);

  if (status === "unauthenticated") {
    return (
      <button
        type="button"
        onClick={signIn}
        className="flex items-center gap-1.5 px-3 py-2 bg-[#c7ff2e]/10 hover:bg-[#c7ff2e]/20 border border-[#c7ff2e]/25 hover:border-[#c7ff2e]/40 text-[#c7ff2e] rounded-[10px] text-sm font-semibold transition-all duration-200 cursor-pointer"
      >
        <SignInIcon width={14} height={14} />
        {t("common.signIn")}
      </button>
    );
  }

  if (status === "authenticating" || status === "deauthenticating") {
    return (
      <div className="flex items-center justify-center w-8 h-8">
        <Spinner size="sm" color="current" className="text-zinc-500" />
      </div>
    );
  }

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative cursor-pointer">
        <GradientAvatar seed={displayAddress} size={32} />
        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-zinc-900 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        </div>
      </div>

      <KycModal
        isOpen={isKycModalOpen}
        onClose={() => setIsKycModalOpen(false)}
        kycUrl={kalshiKycUrl}
      />

      {evmAddress && (
        <SetupModal
          isOpen={isSetupModalOpen}
          onClose={() => setIsSetupModalOpen(false)}
          evmAddress={evmAddress}
          safeDeployed={polymarketSafeDeployed}
          tokenApproved={polymarketTokenApproved}
          keysConnected={false}
          onDeployAndApprove={handleDeployAndApprove}
        />
      )}

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 z-50 overflow-hidden"
          style={{
            borderRadius: 14,
            border: "1px solid rgba(39,39,42,1)",
            background: "rgba(24,24,27,1)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
        >
          {/* Wallets */}
          <div className="p-2">
            {solanaAddress && (
              <WalletEntry
                address={solanaAddress}
                balance={kalshiUsdcBalance}
                chainName="Solana"
                chainIcon={<SolanaIcon width={24} height={24} />}
                trailing={
                  <>
                    {kalshiKycLoading ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-500/15 text-zinc-400">
                        <span className="inline-block w-2.5 h-2.5 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
                        {t("extend.predict.kyc.verifying")}
                      </span>
                    ) : kalshiKycVerified ? (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400"
                        title={t("extend.predict.kyc.verified")}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {t("extend.predict.kyc.verified")}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsKycModalOpen(true);
                          }}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors cursor-pointer"
                          title={t("extend.predict.kyc.unverified")}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                          {t("extend.predict.kyc.unverifiedShort")}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleKycRefresh();
                          }}
                          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                          title={t("extend.predict.kyc.refresh")}
                          disabled={isKycRefreshing}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={cn(isKycRefreshing && "animate-spin")}
                          >
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                          </svg>
                        </button>
                      </>
                    )}
                  </>
                }
              />
            )}
            {evmAddress && (
              <WalletEntry
                address={evmAddress}
                balance={polymarketUsdcBalance}
                chainName="Polygon"
                chainIcon={<PolygonIcon width={24} height={24} />}
                balancePlaceholder={
                  !polymarketSetupVerified && !polymarketSetupLoading ? (
                    <span className="text-amber-400/80 text-[11px] font-medium">
                      {t("extend.predict.setup.unverifiedShort")}
                    </span>
                  ) : undefined
                }
                trailing={
                  <>
                    {polymarketSetupLoading ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-500/15 text-zinc-400">
                        <span className="inline-block w-2.5 h-2.5 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
                        {t("extend.predict.setup.verifying")}
                      </span>
                    ) : polymarketSetupVerified ? (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400"
                        title={t("extend.predict.setup.verified")}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {t("extend.predict.setup.verified")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSetupModalOpen(true);
                        }}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors cursor-pointer"
                        title={t("extend.predict.setup.unverified")}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        {t("extend.predict.setup.unverifiedShort")}
                      </button>
                    )}
                  </>
                }
              />
            )}
          </div>

          {/* Sign out */}
          <div style={{ borderTop: "1px solid rgba(39,39,42,1)" }} className="p-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-[10px] transition-colors cursor-pointer text-red-400 hover:bg-red-500/10"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-[10px] bg-red-500/10">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              {t("common.signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
