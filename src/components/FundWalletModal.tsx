"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import encodeQR from "@paulmillr/qr";
import { useTranslation } from "@liberfi.io/i18n";
import {
  balanceQueryKey,
  useWithdrawBuildMutation,
  useWithdrawSubmitMutation,
  useWithdrawStatusQuery,
  usePolymarketDepositAddresses,
  usePredictClient,
  type ProviderSource,
} from "@liberfi.io/react-predict";
import { useQueryClient } from "@tanstack/react-query";
import { Chain } from "@liberfi.io/types";
import { usePredictWallet, KycModal, SetupModal } from "@liberfi.io/ui-predict";
import { truncateAddress } from "@liberfi.io/utils";
import { useConnectedWallet } from "@liberfi.io/wallet-connector";
import {
  StyledModal,
  ModalContent,
  cn,
  CopyIcon,
  CheckIcon,
  UsdcIcon,
  SolanaIcon,
  PolygonIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  XCloseIcon,
  toast,
} from "@liberfi.io/ui";
import {
  AsyncModal,
  type RenderAsyncModalProps,
} from "@liberfi.io/ui-scaffold";
import { createWalletClient, custom, parseUnits, type Hex } from "viem";
import { polygon } from "viem/chains";
import { useWallets, type EvmWalletAdapter } from "@liberfi.io/wallet-connector";
import {
  deploySafe,
  executeSafe,
  buildAllApprovalTxns,
  buildTransferCalldata,
  pollTransaction,
  POLYMARKET_CONTRACTS,
  type PolymarketRelayConfig,
} from "../lib/polymarket-relay";
import { polymarketSetupQueryKey } from "@liberfi.io/react-predict";

export const FUND_WALLET_MODAL_ID = "fund-prediction-wallet";

type WalletSource = "solana" | "evm";
type Screen = "main" | "deposit" | "withdraw";

// ---------------------------------------------------------------------------
// Modal shell
// ---------------------------------------------------------------------------

export function FundWalletModal() {
  return (
    <AsyncModal id={FUND_WALLET_MODAL_ID}>
      {(props: RenderAsyncModalProps) => (
        <StyledModal
          isOpen={props.isOpen}
          onOpenChange={props.onOpenChange}
          size="md"
          classNames={{
            base: "!bg-[#18181b] !rounded-[14px] !border !border-[rgba(39,39,42,1)] !shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
            body: "!p-0",
          }}
        >
          <ModalContent>
            <FundWalletContent onClose={props.onClose} />
          </ModalContent>
        </StyledModal>
      )}
    </AsyncModal>
  );
}

// ---------------------------------------------------------------------------
// Content router
// ---------------------------------------------------------------------------

function FundWalletContent({ onClose }: { onClose: () => void }) {
  const [screen, setScreen] = useState<Screen>("main");
  const [selectedWallet, setSelectedWallet] = useState<WalletSource>("solana");

  const goMain = useCallback(() => setScreen("main"), []);

  switch (screen) {
    case "deposit":
      return (
        <DepositScreen
          selectedWallet={selectedWallet}
          onSelectWallet={setSelectedWallet}
          onBack={goMain}
          onClose={onClose}
        />
      );
    case "withdraw":
      return (
        <WithdrawScreen
          selectedWallet={selectedWallet}
          onSelectWallet={setSelectedWallet}
          onBack={goMain}
          onClose={onClose}
        />
      );
    default:
      return (
        <MainScreen
          selectedWallet={selectedWallet}
          onSelectWallet={setSelectedWallet}
          onDeposit={() => setScreen("deposit")}
          onWithdraw={() => setScreen("withdraw")}
          onClose={onClose}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Shared: wallet selector dropdown
// ---------------------------------------------------------------------------

function WalletSelector({
  selected,
  onSelect,
}: {
  selected: WalletSource;
  onSelect: (w: WalletSource) => void;
}) {
  const [open, setOpen] = useState(false);
  const {
    solanaAddress,
    evmAddress,
    kalshiUsdcBalance,
    polymarketUsdcBalance,
  } = usePredictWallet();

  const wallets = useMemo(() => {
    const list: {
      key: WalletSource;
      address?: string;
      balance: number | null;
      chainName: string;
      chainIcon: ReactNode;
    }[] = [];
    if (solanaAddress) {
      list.push({
        key: "solana",
        address: solanaAddress,
        balance: kalshiUsdcBalance,
        chainName: "Solana",
        chainIcon: <SolanaIcon width={24} height={24} />,
      });
    }
    if (evmAddress) {
      list.push({
        key: "evm",
        address: evmAddress,
        balance: polymarketUsdcBalance,
        chainName: "Polygon",
        chainIcon: <PolygonIcon width={24} height={24} />,
      });
    }
    return list;
  }, [solanaAddress, evmAddress, kalshiUsdcBalance, polymarketUsdcBalance]);

  const current = wallets.find((w) => w.key === selected) ?? wallets[0];

  if (!current) return null;

  return (
    <div className="relative">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] bg-zinc-800/50 hover:bg-[rgba(39,39,42,0.5)] border border-zinc-700/50 transition-colors cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        onClick={() => setOpen((v) => !v)}
      >
        <div
          className="flex items-center justify-center w-7 h-7 rounded-[10px]"
          style={{
            background: "linear-gradient(to bottom right, rgba(199,255,46,0.08), rgba(23,201,100,0.08))",
            border: "1px solid rgba(199,255,46,0.1)",
          }}
        >
          {current.chainIcon}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-medium text-zinc-300 truncate">
            {current.address ? truncateAddress(current.address) : "—"}
          </div>
          <div className="text-xs text-zinc-500">
            ${formatUsdc(current.balance ?? 0)} USDC · {current.chainName}
          </div>
        </div>
        <ChevronDownIcon
          width={16}
          height={16}
          className={cn(
            "text-zinc-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && wallets.length > 1 && (
        <div
          className="absolute left-0 right-0 mt-2 z-50 overflow-hidden"
          style={{
            borderRadius: 14,
            border: "1px solid rgba(39,39,42,1)",
            background: "rgba(24,24,27,1)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
        >
          <div className="p-1">
            {wallets
              .filter((w) => w.key !== selected)
              .map((w) => (
                <button
                  key={w.key}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-[rgba(39,39,42,0.5)] transition-colors cursor-pointer"
                  onClick={() => {
                    onSelect(w.key);
                    setOpen(false);
                  }}
                >
                  <div
                    className="flex items-center justify-center w-7 h-7 rounded-[10px]"
                    style={{
                      background: "linear-gradient(to bottom right, rgba(199,255,46,0.08), rgba(23,201,100,0.08))",
                      border: "1px solid rgba(199,255,46,0.1)",
                    }}
                  >
                    {w.chainIcon}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-zinc-300 truncate">
                      {w.address ? truncateAddress(w.address) : "—"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      ${formatUsdc(w.balance ?? 0)} USDC · {w.chainName}
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: header bar
// ---------------------------------------------------------------------------

function ModalHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-1 rounded-[10px] hover:bg-[rgba(39,39,42,0.5)] text-zinc-400 hover:text-white transition-colors cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>
        )}
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-[10px] hover:bg-[rgba(39,39,42,0.5)] text-zinc-400 hover:text-white transition-colors cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <XCloseIcon width={18} height={18} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MainScreen
// ---------------------------------------------------------------------------

function MainScreen({
  selectedWallet,
  onSelectWallet,
  onDeposit,
  onWithdraw,
  onClose,
}: {
  selectedWallet: WalletSource;
  onSelectWallet: (w: WalletSource) => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const {
    kalshiUsdcBalance,
    polymarketUsdcBalance,
    kalshiKycVerified,
    kalshiKycUrl,
    polymarketSetupVerified,
    polymarketSafeDeployed,
    polymarketTokenApproved,
    evmAddress,
  } = usePredictWallet();

  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  const wallets = useWallets();
  const queryClient = useQueryClient();

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

  const isSolana = selectedWallet === "solana";
  const balance = isSolana ? kalshiUsdcBalance : polymarketUsdcBalance;

  const needsKyc = isSolana && !kalshiKycVerified;
  const needsSetup = !isSolana && !polymarketSetupVerified;
  const needsPrerequisite = needsKyc || needsSetup;

  return (
    <div>
      <ModalHeader title={t("extend.predict.fundWallet.title")} onClose={onClose} />
      <div className="px-5 pb-5 space-y-4">
        <WalletSelector selected={selectedWallet} onSelect={onSelectWallet} />

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
            onDeployAndApprove={handleDeployAndApprove}
          />
        )}

        {needsPrerequisite ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <p className="text-sm text-zinc-400 text-center">
              {needsKyc
                ? t("extend.predict.kyc.unverified")
                : t("extend.predict.setup.unverified")}
            </p>
            <button
              type="button"
              onClick={() => needsKyc ? setIsKycModalOpen(true) : setIsSetupModalOpen(true)}
              className="px-6 py-2.5 rounded-[10px] bg-[#c7ff2e]/10 border border-[#c7ff2e]/25 text-[#c7ff2e] hover:bg-[#c7ff2e]/20 hover:border-[#c7ff2e]/40 text-sm font-semibold transition-colors cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {needsKyc
                ? t("extend.predict.kyc.unverifiedShort")
                : t("extend.predict.setup.unverifiedShort")}
            </button>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1">
                {t("extend.predict.fundWallet.walletBalance")}
              </div>
              <div className="flex items-center justify-center gap-2">
                <UsdcIcon width={24} height={24} />
              <span className="text-2xl font-bold text-[#c7ff2e] tabular-nums">
                ${formatUsdc(balance ?? 0)}
              </span>
              <span className="text-sm text-zinc-500 self-end mb-0.5">USDC</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onDeposit}
                className="flex flex-col items-center gap-2 p-4 rounded-[14px] border border-[#c7ff2e]/20 bg-[#c7ff2e]/5 hover:bg-[#c7ff2e]/10 hover:border-[#c7ff2e]/40 transition-colors cursor-pointer group focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <div className="w-10 h-10 rounded-full bg-[#c7ff2e]/10 flex items-center justify-center group-hover:bg-[#c7ff2e]/20 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#c7ff2e]">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#c7ff2e]">{t("extend.predict.fundWallet.deposit")}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{t("extend.predict.fundWallet.depositSubtitle")}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={onWithdraw}
                className="flex flex-col items-center gap-2 p-4 rounded-[14px] border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/40 transition-colors cursor-pointer group focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-orange-400">{t("extend.predict.fundWallet.withdraw")}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{t("extend.predict.fundWallet.withdrawSubtitle")}</div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DepositScreen
// ---------------------------------------------------------------------------

function QRCodeImage({ value }: { value: string }) {
  const svgString = useMemo(() => {
    try {
      return encodeQR(value, "svg", { ecc: "high" });
    } catch {
      return null;
    }
  }, [value]);

  if (!svgString) return null;

  return (
    <div
      className="rounded-[10px] overflow-hidden border border-zinc-700 bg-white p-2"
      style={{ width: 180, height: 180 }}
      dangerouslySetInnerHTML={{ __html: svgString }}
      aria-hidden="true"
    />
  );
}

function CopyAddressRow({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  return (
    <div className="flex items-center gap-2 bg-zinc-800/50 rounded-[10px] px-3 py-2 border border-zinc-700/50">
      <span className="flex-1 font-mono text-xs text-zinc-300 truncate">
        {address}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="p-1.5 rounded-[10px] hover:bg-[rgba(39,39,42,0.5)] text-zinc-500 hover:text-white transition-colors cursor-pointer shrink-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        aria-label="Copy address"
      >
        {copied ? (
          <CheckIcon width={14} height={14} className="text-[#c7ff2e]" />
        ) : (
          <CopyIcon width={14} height={14} />
        )}
      </button>
    </div>
  );
}

function DepositScreen({
  selectedWallet,
  onSelectWallet,
  onBack,
  onClose,
}: {
  selectedWallet: WalletSource;
  onSelectWallet: (w: WalletSource) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const {
    solanaAddress,
    kalshiUsdcBalance,
    polymarketUsdcBalance,
    polymarketSafeAddress,
  } = usePredictWallet();

  const { data: depositAddresses, isLoading: depositAddressesLoading } =
    usePolymarketDepositAddresses(polymarketSafeAddress);

  const isSolana = selectedWallet === "solana";
  const address = isSolana
    ? solanaAddress
    : depositAddresses?.evm ?? undefined;
  const balance = isSolana ? kalshiUsdcBalance : polymarketUsdcBalance;
  const chainName = isSolana ? "Solana" : "Polygon";

  const explorerUrl = useMemo(() => {
    if (!polymarketSafeAddress && !solanaAddress) return null;
    return isSolana
      ? `https://solscan.io/account/${solanaAddress}`
      : `https://polygonscan.com/address/${polymarketSafeAddress}`;
  }, [polymarketSafeAddress, solanaAddress, isSolana]);

  return (
    <div>
      <ModalHeader title={t("extend.predict.fundWallet.depositTitle")} onBack={onBack} onClose={onClose} />
      <div className="px-5 pb-5 space-y-4">
        <WalletSelector selected={selectedWallet} onSelect={onSelectWallet} />

        {/* Info banner */}
        <div className="bg-[#c7ff2e]/5 border border-[#c7ff2e]/15 rounded-[10px] px-3 py-2.5">
          <p className="text-xs text-[#c7ff2e]/70 leading-relaxed">
            {t("extend.predict.fundWallet.depositInfo", { chain: chainName })}
          </p>
        </div>

        {!isSolana && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-[10px] px-3 py-2">
            <p className="text-xs text-amber-300">
              {t("extend.predict.fundWallet.depositMinAmount", { amount: "2" })}
            </p>
          </div>
        )}

        {!isSolana && depositAddressesLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-zinc-600 border-t-zinc-300" />
          </div>
        ) : address ? (
          <>
            {/* QR Code */}
            <div className="flex justify-center">
              <QRCodeImage value={address} />
            </div>

            {/* Address label + copy */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                {t("extend.predict.fundWallet.yourAddress", { chain: chainName })}
              </div>
              <CopyAddressRow address={address} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-zinc-500">{t("extend.predict.fundWallet.walletNotConnected")}</span>
          </div>
        )}

        {/* Balance display */}
        <div className="flex items-center justify-between bg-zinc-800/30 rounded-[10px] px-3 py-2.5 border border-zinc-700/50">
          <span className="text-xs text-zinc-400">{t("extend.predict.fundWallet.currentBalance")}</span>
          <div className="flex items-center gap-1.5">
            <UsdcIcon width={14} height={14} />
            <span className="text-sm font-medium text-[#c7ff2e] tabular-nums">
              ${formatUsdc(balance ?? 0)}
            </span>
          </div>
        </div>

        {/* Supported tokens */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {t("extend.predict.fundWallet.supported")}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800/60 rounded-md text-[10px] text-zinc-300 border border-zinc-700/50">
            <UsdcIcon width={12} height={12} /> USDC
          </span>
          {isSolana && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800/60 rounded-md text-[10px] text-zinc-300 border border-zinc-700/50">
              <SolanaIcon width={12} height={12} /> {t("extend.predict.fundWallet.solForFees")}
            </span>
          )}
        </div>

        {/* Explorer link */}
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] border border-zinc-700/50 bg-zinc-800/60 hover:bg-zinc-800 text-sm text-zinc-300 hover:text-white transition-all"
          >
            {t("extend.predict.fundWallet.viewOnExplorer", { explorer: isSolana ? "Solscan" : "Polygonscan" })}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WithdrawScreen
// ---------------------------------------------------------------------------

const POLYMARKET_MIN_WITHDRAW_USD = 2;

function WithdrawScreen({
  selectedWallet,
  onSelectWallet,
  onBack,
  onClose,
}: {
  selectedWallet: WalletSource;
  onSelectWallet: (w: WalletSource) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const {
    solanaAddress,
    evmAddress,
    kalshiUsdcBalance,
    polymarketUsdcBalance,
    polymarketSafeAddress,
  } = usePredictWallet();

  const isSolana = selectedWallet === "solana";
  const fromAddress = isSolana ? solanaAddress : evmAddress;
  const balance = isSolana ? kalshiUsdcBalance : polymarketUsdcBalance;
  const chainName = isSolana ? "Solana" : "Polygon";
  const source: ProviderSource = isSolana ? "kalshi" : "polymarket";

  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const solanaWallet = useConnectedWallet(Chain.SOLANA);
  const queryClient = useQueryClient();
  const predictClient = usePredictClient();
  const wallets = useWallets();

  const relayConfig: PolymarketRelayConfig = useMemo(
    () => ({ signProxyUrl: "/predict-api/api/v1/polymarket/sign" }),
    [],
  );

  const buildMutation = useWithdrawBuildMutation();
  const submitMutation = useWithdrawSubmitMutation();

  const { data: statusData } = useWithdrawStatusQuery({
    txHash,
    source,
  });

  // Handle confirmed/failed status — invalidate balance cache so UI refreshes immediately
  const withdrawStatus = statusData?.status;
  useEffect(() => {
    if (withdrawStatus === "confirmed") {
      toast.success(t("extend.predict.fundWallet.withdrawalConfirmed"));
      if (fromAddress) {
        queryClient.invalidateQueries({
          queryKey: balanceQueryKey(source, fromAddress),
        });
      }
      onClose();
    } else if (withdrawStatus === "failed") {
      toast.error(t("extend.predict.fundWallet.withdrawalFailed"));
      setTxHash(undefined);
      setIsSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawStatus]);

  const handleMax = useCallback(() => {
    if (balance != null) {
      setAmount(formatUsdc(balance));
    }
  }, [balance]);

  const parsedAmount = parseFloat(amount.replace(/,/g, ""));
  const trimmedDest = destination.trim();
  const isValidAddress = isSolana
    ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmedDest)
    : /^0x[0-9a-fA-F]{40}$/.test(trimmedDest);

  const isBelowMinimum = !isSolana && !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount < POLYMARKET_MIN_WITHDRAW_USD;

  const balanceCents = toCents(balance ?? 0);
  const isValid =
    !isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    !isBelowMinimum &&
    toCents(parsedAmount) <= balanceCents &&
    isValidAddress &&
    fromAddress != null;

  const handleSubmit = useCallback(async () => {
    if (!isValid || !fromAddress) return;
    setIsSubmitting(true);

    try {
      if (isSolana) {
        const buildResult = await buildMutation.mutateAsync({
          source,
          from: fromAddress,
          to: destination.trim(),
          amount: String(parsedAmount),
        });

        if (!solanaWallet) throw new Error("wallet_not_connected");
        const txBytes = Uint8Array.from(atob(buildResult.serialized_tx), (c) =>
          c.charCodeAt(0),
        );
        const signedBytes = await solanaWallet.signTransaction(txBytes);
        const signedBase64 = btoa(
          String.fromCharCode(...new Uint8Array(signedBytes)),
        );

        const submitResult = await submitMutation.mutateAsync({
          source,
          signed_tx: signedBase64,
        });
        toast.success(t("extend.predict.fundWallet.txSubmitted"));
        setTxHash(submitResult.tx_hash);
      } else {
        if (!evmAddress || !polymarketSafeAddress)
          throw new Error("wallet_not_connected");

        const { deposit_address } =
          await predictClient.preparePolymarketWithdraw({
            safe_address: polymarketSafeAddress,
            to: destination.trim(),
          });

        const evmWallet = wallets.find(
          (w) => w.chainNamespace === "EVM" && w.isConnected,
        ) as EvmWalletAdapter | undefined;
        if (!evmWallet) throw new Error("wallet_not_connected");

        await evmWallet.switchChain("137" as never);
        const provider = await evmWallet.getEip1193Provider();
        if (!provider) throw new Error("Cannot get EIP-1193 provider");

        const walletClient = createWalletClient({
          account: evmAddress as Hex,
          chain: polygon,
          transport: custom(provider),
        });

        const amountSmallest = parseUnits(String(parsedAmount), 6);
        const transferTx = {
          to: POLYMARKET_CONTRACTS.USDC_E,
          data: buildTransferCalldata(
            deposit_address as Hex,
            amountSmallest,
          ),
        };

        const result = await executeSafe(
          walletClient,
          [transferTx],
          relayConfig,
        );

        if (result.transactionID) {
          toast.success(t("extend.predict.fundWallet.txSubmitted"));
          await pollTransaction(relayConfig, result.transactionID);
        }

        queryClient.invalidateQueries({
          queryKey: balanceQueryKey(source, evmAddress),
        });
        onClose();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      toast.error(friendlyWithdrawError(raw, t as (key: string) => string));
      setIsSubmitting(false);
    }
  }, [
    isValid,
    fromAddress,
    source,
    destination,
    parsedAmount,
    isSolana,
    solanaWallet,
    evmAddress,
    polymarketSafeAddress,
    buildMutation,
    submitMutation,
    predictClient,
    wallets,
    relayConfig,
    queryClient,
    onClose,
    t,
  ]);

  const isPending = isSubmitting || !!txHash;

  return (
    <div>
      <ModalHeader title={t("extend.predict.fundWallet.withdrawTitle")} onBack={onBack} onClose={onClose} />
      <div className="px-5 pb-5 space-y-4">
        <WalletSelector selected={selectedWallet} onSelect={onSelectWallet} />

        {/* Info banner */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-[10px] px-3 py-2.5">
          <p className="text-xs text-amber-300 leading-relaxed">
            {t("extend.predict.fundWallet.withdrawInfo", { chain: chainName })}
          </p>
        </div>

        {!isSolana && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-[10px] px-3 py-2">
            <p className="text-xs text-amber-300">
              {t("extend.predict.fundWallet.minWithdrawAmount", { amount: `$${POLYMARKET_MIN_WITHDRAW_USD}` })}
            </p>
          </div>
        )}

        {/* Available balance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <UsdcIcon width={16} height={16} />
            <span className="text-xs text-zinc-400">{t("extend.predict.fundWallet.available")}</span>
          </div>
          <span className="text-sm font-medium text-white tabular-nums">
            ${formatUsdc(balance ?? 0)}
          </span>
        </div>

        {/* Amount input */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            {t("extend.predict.fundWallet.amount")}
          </label>
          <div className="flex items-center bg-zinc-800/50 border border-zinc-700/50 rounded-[10px] focus-within:border-[#c7ff2e]/30">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setAmount(v);
              }}
              disabled={isPending}
              className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none tabular-nums"
            />
            <button
              type="button"
              onClick={handleMax}
              disabled={isPending}
              className="px-2 py-1 mr-2 text-[10px] font-semibold text-[#c7ff2e] hover:text-[#c7ff2e]/80 bg-[#c7ff2e]/10 hover:bg-[#c7ff2e]/20 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              MAX
            </button>
            <span className="pr-3 text-xs text-zinc-500">USDC</span>
          </div>
        </div>

        {/* Destination address input */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            {t("extend.predict.fundWallet.destinationAddress")}
          </label>
          <input
            type="text"
            placeholder={t("extend.predict.fundWallet.addressPlaceholder", { chain: chainName })}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            disabled={isPending}
            className={cn(
              "w-full bg-zinc-800/50 border rounded-[10px] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none font-mono",
              trimmedDest.length > 0 && !isValidAddress
                ? "border-red-500/60 focus:border-red-500"
                : "border-zinc-700/50 focus:border-[#c7ff2e]/30",
            )}
          />
          {trimmedDest.length > 0 && !isValidAddress && (
            <p className="text-[10px] text-red-400">
              {t("extend.predict.fundWallet.invalidAddress", { chain: chainName })}
            </p>
          )}
        </div>

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || isPending}
          className={cn(
            "w-full py-3 rounded-[10px] text-sm font-semibold transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            isValid && !isPending
              ? "bg-[#c7ff2e] text-zinc-900 hover:bg-[#c7ff2e]/90 cursor-pointer"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed",
          )}
        >
          {isPending
            ? txHash
              ? t("extend.predict.fundWallet.confirming")
              : t("extend.predict.fundWallet.signing")
            : t("extend.predict.fundWallet.withdrawButton")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCents(amount: number): number {
  return Math.floor(amount * 100);
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUsdc(amount: number): string {
  return formatCents(toCents(amount));
}

const WITHDRAW_ERROR_PATTERNS: [RegExp, string][] = [
  [/insufficient_gas|insufficient funds/i, "extend.predict.fundWallet.errorInsufficientGas"],
  [/user (rejected|denied|cancelled)/i, "extend.predict.fundWallet.errorTxCancelled"],
  [/unsupported chainId/i, "extend.predict.fundWallet.errorUnsupportedChain"],
  [/wallet.not.connected|wallet_not_connected/i, "extend.predict.fundWallet.errorWalletNotConnected"],
  [/provider.not.available|provider_not_available/i, "extend.predict.fundWallet.errorProviderUnavailable"],
];

function friendlyWithdrawError(
  raw: string,
  t: (key: string) => string,
): string {
  for (const [pattern, key] of WITHDRAW_ERROR_PATTERNS) {
    if (pattern.test(raw)) return t(key);
  }
  return raw;
}
