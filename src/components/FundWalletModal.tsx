"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import encodeQR from "@paulmillr/qr";
import { useAtomValue } from "jotai";
import { useTranslation } from "@liberfi.io/i18n";
import {
  balanceQueryKey,
  useWithdrawBuildMutation,
  useWithdrawSubmitMutation,
  useWithdrawStatusQuery,
  usePolymarketDepositAddresses,
  usePolymarketSupportedAssets,
  useDeployPolymarketDepositWallet,
  type ProviderSource,
  type PolymarketSupportedAsset,
} from "@liberfi.io/react-predict";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  UsdtIcon,
  SolanaIcon,
  PolygonIcon,
  EthereumIcon,
  BinanceIcon,
  BaseIcon,
  TronIcon,
  TokenIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  XCloseIcon,
  toast,
  Spinner,
} from "@liberfi.io/ui";
import {
  AsyncModal,
  type RenderAsyncModalProps,
} from "@liberfi.io/ui-scaffold";
import { createWalletClient, custom, type Hex } from "viem";
import { polygon } from "viem/chains";
import { useWallets, type EvmWalletAdapter } from "@liberfi.io/wallet-connector";
import {
  deploySafe,
  executeSafe,
  executeDepositWalletBatch,
  buildAllApprovalTxns,
  buildAllDepositApprovalCalls,
  pollTransaction,
  type PolymarketRelayConfig,
} from "../lib/polymarket-relay";
import {
  DEPOSIT_CHAINS,
  DEPOSIT_CHAIN_ORDER,
  type DepositChainConfig,
  type DepositChainKey,
} from "../lib/polymarket-deposit-chains";
import { polymarketAutoSetupPendingAtom } from "../lib/polymarketAutoSetupState";
import { polymarketSetupQueryKey } from "@liberfi.io/react-predict";

export const FUND_WALLET_MODAL_ID = "fund-prediction-wallet";

type WalletSource = "solana" | "evm";
type Screen = "main" | "deposit" | "withdraw";
const DEFAULT_DEPOSIT_CHAIN_KEY: DepositChainKey = "tron";

/**
 * Optional payload accepted by `useAsyncModal(FUND_WALLET_MODAL_ID).onOpen({ params })`.
 * When provided, lets the caller jump directly to the Deposit (or Withdraw)
 * screen with a specific wallet (e.g. "evm" for Polymarket, "solana" for
 * Kalshi) preselected, instead of always landing on the Main choice screen.
 */
export type FundWalletParams = {
  initialScreen?: Screen;
  initialWallet?: WalletSource;
};

// ---------------------------------------------------------------------------
// Modal shell
// ---------------------------------------------------------------------------

export function FundWalletModal() {
  return (
    <AsyncModal<FundWalletParams> id={FUND_WALLET_MODAL_ID}>
      {(props: RenderAsyncModalProps<FundWalletParams>) => (
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
            <FundWalletContent
              isOpen={props.isOpen}
              onClose={props.onClose}
              params={props.params}
            />
          </ModalContent>
        </StyledModal>
      )}
    </AsyncModal>
  );
}

// ---------------------------------------------------------------------------
// Content router
// ---------------------------------------------------------------------------

function FundWalletContent({
  isOpen,
  onClose,
  params,
}: {
  isOpen: boolean;
  onClose: () => void;
  params?: FundWalletParams;
}) {
  const {
    kalshiKycVerified,
    kalshiKycLoading,
    polymarketSetupVerified,
    polymarketSetupLoading,
  } = usePredictWallet();

  // Never jump straight to the deposit screen before the venue prerequisite is
  // satisfied: Kalshi requires KYC, Polymarket requires the account (deposit /
  // Safe wallet) to be deployed + approved. When the prerequisite is unmet we
  // land on the main screen instead so its gate surfaces the verify / setup
  // prompt first. The loading guard avoids forcing the main screen while the
  // status is still resolving (which would strand a fully-set-up user).
  const resolveInitialScreen = useCallback(
    (p?: FundWalletParams): Screen => {
      const requested = p?.initialScreen ?? "main";
      if (requested !== "deposit") return requested;
      const wallet = p?.initialWallet ?? "solana";
      const loading =
        wallet === "evm" ? polymarketSetupLoading : kalshiKycLoading;
      const verified =
        wallet === "evm" ? polymarketSetupVerified : kalshiKycVerified;
      return !loading && !verified ? "main" : requested;
    },
    [
      polymarketSetupLoading,
      polymarketSetupVerified,
      kalshiKycLoading,
      kalshiKycVerified,
    ],
  );

  const [screen, setScreen] = useState<Screen>(() =>
    resolveInitialScreen(params),
  );
  const [selectedWallet, setSelectedWallet] = useState<WalletSource>(
    params?.initialWallet ?? "solana",
  );

  // The modal content stays mounted across open/close cycles, so the initial
  // `useState` values only apply once. Re-sync the target screen / wallet on
  // every open transition so caller-supplied `params` (e.g. header deposit /
  // withdraw) take effect instead of showing the stale previous screen.
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setScreen(resolveInitialScreen(params));
      setSelectedWallet(params?.initialWallet ?? "solana");
    }
    wasOpen.current = isOpen;
  }, [isOpen, params, resolveInitialScreen]);

  switch (screen) {
    case "deposit":
      return <DepositScreen selectedWallet={selectedWallet} onClose={onClose} />;
    case "withdraw":
      return <WithdrawScreen selectedWallet={selectedWallet} onClose={onClose} />;
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
    polymarketWalletKind,
    polymarketWalletDeployed,
    polymarketDepositWalletAddress,
    polymarketTokenApproved,
    polymarketSetupLoading,
    evmAddress,
  } = usePredictWallet();
  const polymarketAutoSetupPending = useAtomValue(polymarketAutoSetupPendingAtom);

  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  const wallets = useWallets();
  const queryClient = useQueryClient();
  const deployDepositWallet = useDeployPolymarketDepositWallet(evmAddress);

  const relayConfig: PolymarketRelayConfig = useMemo(
    () => ({ signProxyUrl: "/predict-api/api/v1/polymarket/sign" }),
    [],
  );

  // Default to the deposit-wallet model: only the explicit legacy `safe` kind
  // takes the Gnosis Safe path. Treating any non-`safe` value (including an
  // unresolved status) as deposit prevents accidentally deploying a Safe for a
  // brand-new EOA.
  const isDepositWallet = polymarketWalletKind !== "safe";

  const handleDeployAndApprove = useCallback(async () => {
    // Hard gate: never deploy before the authoritative Polymarket setup status
    // resolves. The active wallet model (deposit vs. legacy Safe) is decided by
    // `wallet_kind`; acting while it is still loading risks deploying the wrong
    // wallet type for the EOA (e.g. a Gnosis Safe for a brand-new user).
    if (polymarketSetupLoading) {
      throw new Error("Wallet status is still loading, please try again");
    }

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

    if (isDepositWallet) {
      // Deposit wallet path: gasless server-side WALLET-CREATE (no signature),
      // then a single WALLET batch granting pUSD + CTF approvals.
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
      const approveResult = await executeSafe(walletClient, approvalTxns, relayConfig);
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

  const isSolana = selectedWallet === "solana";
  const balance = isSolana ? kalshiUsdcBalance : polymarketUsdcBalance;
  const polymarketSetupBusy =
    polymarketSetupLoading || polymarketAutoSetupPending;

  const needsKyc = isSolana && !kalshiKycVerified;
  const needsSetup = !isSolana && !polymarketSetupVerified;
  const setupInProgress = !isSolana && polymarketSetupBusy && needsSetup;
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
            walletKind={polymarketWalletKind}
            safeDeployed={polymarketWalletDeployed}
            tokenApproved={polymarketTokenApproved}
            onDeployAndApprove={handleDeployAndApprove}
          />
        )}

        {needsPrerequisite ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center",
                setupInProgress ? "bg-[#c7ff2e]/10" : "bg-amber-500/10",
              )}
            >
              {setupInProgress ? (
                <Spinner size="sm" color="current" className="text-[#c7ff2e]" />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </div>
            <p className="text-sm text-zinc-400 text-center">
              {needsKyc
                ? t("extend.predict.kyc.unverified")
                : setupInProgress
                  ? t("extend.predict.setup.verifying")
                  : t("extend.predict.setup.unverified")}
            </p>
            {!setupInProgress && (
              <button
                type="button"
                onClick={() => needsKyc ? setIsKycModalOpen(true) : setIsSetupModalOpen(true)}
                className="px-6 py-2.5 rounded-[10px] bg-[#c7ff2e]/10 border border-[#c7ff2e]/25 text-[#c7ff2e] hover:bg-[#c7ff2e]/20 hover:border-[#c7ff2e]/40 text-sm font-semibold transition-colors cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {needsKyc
                  ? t("extend.predict.kyc.unverifiedShort")
                  : t("extend.predict.setup.unverifiedShort")}
              </button>
            )}
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

/**
 * Renders the small chain icon shown inside `DepositChainTab` chips.
 *
 * Kept inline so we can swap implementations easily without exporting more
 * surface area — each chain only needs a constant icon component.
 */
function chainIcon(key: DepositChainKey, size = 14): ReactNode {
  switch (key) {
    case "solana":
      return <SolanaIcon width={size} height={size} />;
    case "ethereum":
      return <EthereumIcon width={size} height={size} />;
    case "base":
      return <BaseIcon width={size} height={size} />;
    case "polygon":
      return <PolygonIcon width={size} height={size} />;
    case "bnb":
      return <BinanceIcon width={size} height={size} />;
    case "tron":
      return <TronIcon width={size} height={size} />;
  }
}

/**
 * Network picker shown above the QR code on the Polymarket deposit screen.
 *
 * Visual treatment matches `WalletSelector` (trigger button + absolute
 * popover) so the two stacked selectors feel like a single control family.
 * Hidden when only one chain is available (defensive — bridge always returns
 * at least Solana + EVM).
 */
function DepositChainSelect({
  chains,
  value,
  onChange,
}: {
  chains: DepositChainConfig[];
  value: DepositChainKey;
  onChange: (key: DepositChainKey) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (chains.length <= 1) return null;

  const current = chains.find((c) => c.key === value) ?? chains[0];

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
        {t("extend.predict.fundWallet.network")}
      </div>
      <div className="relative">
        <button
          type="button"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] bg-zinc-800/50 hover:bg-[rgba(39,39,42,0.5)] border border-zinc-700/50 transition-colors cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={() => setOpen((v) => !v)}
        >
          <div
            className="flex items-center justify-center w-7 h-7 rounded-[10px]"
            style={{
              background:
                "linear-gradient(to bottom right, rgba(199,255,46,0.08), rgba(23,201,100,0.08))",
              border: "1px solid rgba(199,255,46,0.1)",
            }}
          >
            {chainIcon(current.key, 18)}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium text-zinc-200 truncate">
              {current.label}
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

        {open && (
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
              {chains
                .filter((c) => c.key !== value)
                .map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-[rgba(39,39,42,0.5)] transition-colors cursor-pointer"
                    onClick={() => {
                      onChange(c.key);
                      setOpen(false);
                    }}
                  >
                    <div
                      className="flex items-center justify-center w-7 h-7 rounded-[10px]"
                      style={{
                        background:
                          "linear-gradient(to bottom right, rgba(199,255,46,0.08), rgba(23,201,100,0.08))",
                        border: "1px solid rgba(199,255,46,0.1)",
                      }}
                    >
                      {chainIcon(c.key, 18)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-zinc-200">
                        {c.label}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * For the Kalshi (Solana account) branch, the deposit destination is always
 * the user's own Solana TEE wallet — no bridge involved. We keep this branch
 * isolated from the Polymarket multi-chain flow so the Kalshi UX is unchanged.
 */
function KalshiDepositBody({
  solanaAddress,
  balance,
}: {
  solanaAddress: string | undefined;
  balance: number | null;
}) {
  const { t } = useTranslation();
  const chainName = "Solana";
  const explorerUrl = solanaAddress
    ? `https://solscan.io/account/${solanaAddress}`
    : null;

  return (
    <>
      <div className="bg-[#c7ff2e]/5 border border-[#c7ff2e]/15 rounded-[10px] px-3 py-2.5">
        <p className="text-xs text-[#c7ff2e]/70 leading-relaxed">
          {t("extend.predict.fundWallet.depositInfo", { chain: chainName })}
        </p>
      </div>

      {solanaAddress ? (
        <>
          <div className="flex justify-center">
            <QRCodeImage value={solanaAddress} />
          </div>
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              {t("extend.predict.fundWallet.yourAddress", { chain: chainName })}
            </div>
            <CopyAddressRow address={solanaAddress} />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-32">
          <span className="text-sm text-zinc-500">
            {t("extend.predict.fundWallet.walletNotConnected")}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between bg-zinc-800/30 rounded-[10px] px-3 py-2.5 border border-zinc-700/50">
        <span className="text-xs text-zinc-400">
          {t("extend.predict.fundWallet.currentBalance")}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[#c7ff2e] tabular-nums">
            ${formatUsdc(balance ?? 0)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
          {t("extend.predict.fundWallet.supported")}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800/60 rounded-md text-[10px] text-zinc-300 border border-zinc-700/50">
          <UsdcIcon width={12} height={12} /> USDC
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800/60 rounded-md text-[10px] text-zinc-300 border border-zinc-700/50">
          <SolanaIcon width={12} height={12} />{" "}
          {t("extend.predict.fundWallet.solForFees")}
        </span>
      </div>

      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] border border-zinc-700/50 bg-zinc-800/60 hover:bg-zinc-800 text-sm text-zinc-300 hover:text-white transition-all"
        >
          {t("extend.predict.fundWallet.viewOnExplorer", { explorer: "Solscan" })}
          <ExternalLinkIcon />
        </a>
      )}
    </>
  );
}

/**
 * Polymarket multi-chain deposit body — chain picker (Solana / ETH / Polygon
 * / BNB) drives the QR code, address, minimum-deposit hint, supported-token
 * chips and explorer link.
 *
 * Each EVM chip points at the same bridge `evm` address; only the explorer
 * URL and chip label change. Solana uses the bridge `svm` address.
 */
function PolymarketDepositBody({
  polymarketSafeAddress,
  balance,
}: {
  polymarketSafeAddress: string | undefined;
  balance: number | null;
}) {
  const { t, i18n } = useTranslation();
  const { data: depositAddresses, isLoading: depositAddressesLoading } =
    usePolymarketDepositAddresses(polymarketSafeAddress);
  const { data: supportedAssets } = usePolymarketSupportedAssets();

  const availableChains = useMemo<DepositChainConfig[]>(() => {
    const ordered = DEPOSIT_CHAIN_ORDER.map((k) => DEPOSIT_CHAINS[k]);
    // If we don't yet know what the bridge supports (loading / cold cache),
    // show all configured chains rather than blanking the picker.
    if (!supportedAssets || supportedAssets.length === 0) {
      return ordered;
    }
    const supportedChainIds = new Set(
      supportedAssets.map((a) => a.chainId.toLowerCase()),
    );
    const filtered = ordered.filter((c) =>
      supportedChainIds.has(c.chainId.toLowerCase()),
    );
    return filtered.length > 0 ? filtered : ordered;
  }, [supportedAssets]);

  const [selectedChainKey, setSelectedChainKey] = useState<DepositChainKey>(
    () => getDefaultDepositChainKey(availableChains),
  );

  // Keep the selected chain in sync when the available set changes (e.g.
  // supportedAssets loads in after the modal opened).
  useEffect(() => {
    if (
      availableChains.length > 0 &&
      !availableChains.some((c) => c.key === selectedChainKey)
    ) {
      setSelectedChainKey(getDefaultDepositChainKey(availableChains));
    }
  }, [availableChains, selectedChainKey]);

  const selectedChain =
    availableChains.find((c) => c.key === selectedChainKey) ??
    availableChains.find((c) => c.key === DEFAULT_DEPOSIT_CHAIN_KEY) ??
    availableChains[0];

  const address =
    selectedChain && depositAddresses
      ? selectedChain.bridgeField === "svm"
        ? depositAddresses.svm
        : selectedChain.bridgeField === "tron"
          ? depositAddresses.tron
          : depositAddresses.evm
      : undefined;

  const chainAssets = useMemo(() => {
    if (!supportedAssets || !selectedChain) return [];
    return supportedAssets.filter(
      (a) => a.chainId.toLowerCase() === selectedChain.chainId.toLowerCase(),
    );
  }, [supportedAssets, selectedChain]);

  const minAmountUsd = useMemo(() => {
    if (chainAssets.length === 0) return null;
    return Math.min(...chainAssets.map((a) => a.minCheckoutUsd));
  }, [chainAssets]);

  /**
   * Token chips surface only the chain's native gas token and the two stable
   * coins (USDC, USDT) the bridge actually supports on this chain. Listing
   * every bridge asset is too noisy and most users only ever deposit one of
   * these three; matches the user-facing simplicity of competitor deposit
   * screens.
   */
  const supportedSymbols = useMemo(() => {
    if (!selectedChain) return [];
    const bridgeSymbols = new Set(
      chainAssets
        .map((a) => a.token?.symbol?.toUpperCase())
        .filter((s): s is string => Boolean(s)),
    );
    const out: string[] = [selectedChain.nativeSymbol];
    if (bridgeSymbols.has("USDC")) out.push("USDC");
    if (bridgeSymbols.has("USDT")) out.push("USDT");
    return out;
  }, [chainAssets, selectedChain]);
  const supportedTokenText = useMemo(
    () => formatTokenList(supportedSymbols, i18n.language),
    [i18n.language, supportedSymbols],
  );

  const explorerUrl =
    selectedChain && address ? selectedChain.buildExplorerUrl(address) : null;

  return (
    <>
      <DepositChainSelect
        chains={availableChains}
        value={selectedChainKey}
        onChange={setSelectedChainKey}
      />

      {selectedChain && minAmountUsd != null && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-[10px] px-3 py-2">
          <p className="text-xs text-amber-300">
            {t("extend.predict.fundWallet.depositInfoWithMin", {
              chain: selectedChain.label,
              tokens: supportedTokenText,
              amount: formatMinAmount(minAmountUsd),
            })}
          </p>
        </div>
      )}

      {depositAddressesLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-zinc-600 border-t-zinc-300" />
        </div>
      ) : address && selectedChain ? (
        <>
          <div className="flex justify-center">
            <QRCodeImage value={address} />
          </div>
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              {t("extend.predict.fundWallet.yourAddress", {
                chain: selectedChain.label,
              })}
            </div>
            <CopyAddressRow address={address} />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-32">
          <span className="text-sm text-zinc-500">
            {t("extend.predict.fundWallet.walletNotConnected")}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between bg-zinc-800/30 rounded-[10px] px-3 py-2.5 border border-zinc-700/50">
        <span className="text-xs text-zinc-400">
          {t("extend.predict.fundWallet.currentBalance")}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[#c7ff2e] tabular-nums">
            ${formatUsdc(balance ?? 0)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
          {t("extend.predict.fundWallet.supported")}
        </span>
        {supportedSymbols.map((symbol) => (
          <span
            key={symbol}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800/60 rounded-md text-[10px] text-zinc-300 border border-zinc-700/50"
          >
            <SupportedTokenIcon symbol={symbol} /> {symbol}
          </span>
        ))}
      </div>

      {explorerUrl && selectedChain && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] border border-zinc-700/50 bg-zinc-800/60 hover:bg-zinc-800 text-sm text-zinc-300 hover:text-white transition-all"
        >
          {t("extend.predict.fundWallet.viewOnExplorer", {
            explorer: selectedChain.explorerName,
          })}
          <ExternalLinkIcon />
        </a>
      )}
    </>
  );
}

function SupportedTokenIcon({ symbol }: { symbol: string }) {
  const upper = symbol.toUpperCase();
  switch (upper) {
    case "USDC":
      return <UsdcIcon width={12} height={12} />;
    case "USDT":
      return <UsdtIcon width={12} height={12} />;
    case "SOL":
      return <SolanaIcon width={12} height={12} />;
    case "ETH":
      return <EthereumIcon width={12} height={12} />;
    case "POL":
    case "MATIC":
      return <PolygonIcon width={12} height={12} />;
    case "BNB":
      return <BinanceIcon width={12} height={12} />;
    case "TRX":
      return <TronIcon width={12} height={12} />;
    default:
      return <TokenIcon symbol={upper} size={12} />;
  }
}

function ExternalLinkIcon() {
  return (
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
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function DepositScreen({
  selectedWallet,
  onClose,
}: {
  selectedWallet: WalletSource;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const {
    solanaAddress,
    kalshiUsdcBalance,
    polymarketUsdcBalance,
    polymarketSafeAddress,
    polymarketWalletAddress,
  } = usePredictWallet();

  const isSolana = selectedWallet === "solana";

  return (
    <div>
      <ModalHeader
        title={t("extend.predict.fundWallet.depositTitle")}
        onClose={onClose}
      />
      <div className="px-5 pb-5 space-y-4">
        {isSolana ? (
          <KalshiDepositBody
            solanaAddress={solanaAddress}
            balance={kalshiUsdcBalance}
          />
        ) : (
          <PolymarketDepositBody
            polymarketSafeAddress={
              polymarketWalletAddress ?? polymarketSafeAddress
            }
            balance={polymarketUsdcBalance}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WithdrawScreen
// ---------------------------------------------------------------------------

const PRIMARY_BRIDGE_TOKEN_SYMBOLS = ["USDC", "USDT"] as const;

const STATIC_WITHDRAW_ASSETS: PolymarketSupportedAsset[] = [
  {
    chainId: DEPOSIT_CHAINS.solana.chainId,
    chainName: DEPOSIT_CHAINS.solana.label,
    token: {
      name: "USD Coin",
      symbol: "USDC",
      address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      decimals: 6,
    },
    minCheckoutUsd: 2,
  },
  {
    chainId: DEPOSIT_CHAINS.solana.chainId,
    chainName: DEPOSIT_CHAINS.solana.label,
    token: {
      name: "USDT",
      symbol: "USDT",
      address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      decimals: 6,
    },
    minCheckoutUsd: 2,
  },
  {
    chainId: DEPOSIT_CHAINS.ethereum.chainId,
    chainName: DEPOSIT_CHAINS.ethereum.label,
    token: {
      name: "USDC",
      symbol: "USDC",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
    },
    minCheckoutUsd: 5,
  },
  {
    chainId: DEPOSIT_CHAINS.ethereum.chainId,
    chainName: DEPOSIT_CHAINS.ethereum.label,
    token: {
      name: "Tether USD",
      symbol: "USDT",
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
    },
    minCheckoutUsd: 5,
  },
  {
    chainId: DEPOSIT_CHAINS.base.chainId,
    chainName: DEPOSIT_CHAINS.base.label,
    token: {
      name: "USDC",
      symbol: "USDC",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
    },
    minCheckoutUsd: 2,
  },
  {
    chainId: DEPOSIT_CHAINS.base.chainId,
    chainName: DEPOSIT_CHAINS.base.label,
    token: {
      name: "Tether USD",
      symbol: "USDT",
      address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      decimals: 6,
    },
    minCheckoutUsd: 2,
  },
  {
    chainId: DEPOSIT_CHAINS.polygon.chainId,
    chainName: DEPOSIT_CHAINS.polygon.label,
    token: {
      name: "USDC",
      symbol: "USDC",
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      decimals: 6,
    },
    minCheckoutUsd: 2,
  },
  {
    chainId: DEPOSIT_CHAINS.polygon.chainId,
    chainName: DEPOSIT_CHAINS.polygon.label,
    token: {
      name: "Tether USD",
      symbol: "USDT",
      address: "0x9417669fBF23357D2774e9D421307bd5eA1006d2",
      decimals: 6,
    },
    minCheckoutUsd: 2,
  },
  {
    chainId: DEPOSIT_CHAINS.bnb.chainId,
    chainName: DEPOSIT_CHAINS.bnb.label,
    token: {
      name: "USD Coin",
      symbol: "USDC",
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18,
    },
    minCheckoutUsd: 2,
  },
  {
    chainId: DEPOSIT_CHAINS.bnb.chainId,
    chainName: DEPOSIT_CHAINS.bnb.label,
    token: {
      name: "Tether USD",
      symbol: "USDT",
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
    },
    minCheckoutUsd: 2,
  },
  {
    chainId: DEPOSIT_CHAINS.tron.chainId,
    chainName: DEPOSIT_CHAINS.tron.label,
    token: {
      name: "Tether USD",
      symbol: "USDT",
      address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      decimals: 6,
    },
    minCheckoutUsd: 7,
  },
];

function BridgeTokenPills({
  assets,
  value,
  onChange,
}: {
  assets: PolymarketSupportedAsset[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { t } = useTranslation();
  if (assets.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
        {t("extend.predict.fundWallet.token")}
      </div>
      <div className="flex flex-wrap gap-2">
        {assets.map((asset) => {
          const key = bridgeAssetKey(asset);
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                selected
                  ? "border-[#c7ff2e]/50 bg-[#c7ff2e]/15 text-[#c7ff2e]"
                  : "border-zinc-700/60 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800",
              )}
            >
              <SupportedTokenIcon symbol={asset.token.symbol} />
              {asset.token.symbol}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuoteRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-200 text-right tabular-nums">
        {value}
      </span>
    </div>
  );
}

interface PolymarketWithdrawQuoteResponse {
  quote_id: string;
  est_checkout_time_ms: number;
  est_output_usd: number;
  est_to_token_base_unit: string;
}

interface PolymarketWithdrawPrepareResponse {
  deposit_address: string;
  bridge_address?: string;
}

interface PolymarketWithdrawRelayBuildResponse {
  typed_data: Record<string, unknown>;
  nonce: string;
  deadline: string;
}

interface PolymarketWithdrawRelaySubmitResponse {
  transaction_id: string;
  status: string;
  bridge_address: string;
}

interface PolymarketWithdrawBridgeStatusResponse {
  bridge_status?: string;
  relayer_status?: string;
}

interface WithdrawRelayCall {
  target: string;
  value: string | number | bigint;
  data: string;
}

interface WithdrawRelayTypedData {
  domain: {
    name: string;
    version: string;
    chainId: string | number | bigint;
    verifyingContract: string;
  };
  message: {
    wallet: string;
    nonce: string | number | bigint;
    deadline: string | number | bigint;
    calls: WithdrawRelayCall[];
  };
}

async function signWithdrawRelayTypedData(
  provider: Parameters<typeof custom>[0],
  account: Hex,
  typedData: Record<string, unknown>,
): Promise<string> {
  const data = typedData as unknown as WithdrawRelayTypedData;
  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: custom(provider),
  });

  return walletClient.signTypedData({
    account,
    domain: {
      name: data.domain.name,
      version: data.domain.version,
      chainId: BigInt(data.domain.chainId),
      verifyingContract: data.domain.verifyingContract as Hex,
    },
    types: {
      Call: [
        { name: "target", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
      Batch: [
        { name: "wallet", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "calls", type: "Call[]" },
      ],
    },
    primaryType: "Batch",
    message: {
      wallet: data.message.wallet as Hex,
      nonce: BigInt(data.message.nonce),
      deadline: BigInt(data.message.deadline),
      calls: data.message.calls.map((call) => ({
        target: call.target as Hex,
        value: BigInt(call.value),
        data: call.data as Hex,
      })),
    },
  });
}

async function postPredictApi<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`/predict-api/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `Request failed with ${resp.status}`);
  }
  return (await resp.json()) as T;
}

async function getPredictApi<T>(
  path: string,
  params: Record<string, string | undefined>,
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const resp = await fetch(`/predict-api/api/v1${path}?${qs.toString()}`);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `Request failed with ${resp.status}`);
  }
  return (await resp.json()) as T;
}

function WithdrawScreen({
  selectedWallet,
  onClose,
}: {
  selectedWallet: WalletSource;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const {
    solanaAddress,
    evmAddress,
    kalshiUsdcBalance,
    polymarketUsdcBalance,
    polymarketWalletKind,
    polymarketWalletAddress,
  } = usePredictWallet();

  const isSolana = selectedWallet === "solana";
  const fromAddress = isSolana ? solanaAddress : evmAddress;
  const balance = isSolana ? kalshiUsdcBalance : polymarketUsdcBalance;
  const source: ProviderSource = isSolana ? "kalshi" : "polymarket";

  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [bridgeAddress, setBridgeAddress] = useState<string | undefined>();
  const [transactionId, setTransactionId] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedChainKey, setSelectedChainKey] =
    useState<DepositChainKey>(DEFAULT_DEPOSIT_CHAIN_KEY);
  const [selectedAssetKey, setSelectedAssetKey] = useState<string>("");

  const solanaWallet = useConnectedWallet(Chain.SOLANA);
  const queryClient = useQueryClient();
  const wallets = useWallets();

  const buildMutation = useWithdrawBuildMutation();
  const submitMutation = useWithdrawSubmitMutation();
  const quoteMutation = useMutation({
    mutationFn: (body: {
      wallet_address: string;
      amount: string;
      to_chain_id: string;
      to_token_address: string;
      recipient_address: string;
    }) =>
      postPredictApi<PolymarketWithdrawQuoteResponse>(
        "/withdraw/polymarket/quote",
        body,
      ),
  });
  const prepareMutation = useMutation({
    mutationFn: (body: {
      wallet_address: string;
      to_chain_id: string;
      to_token_address: string;
      recipient_address: string;
      quote_id?: string;
    }) =>
      postPredictApi<PolymarketWithdrawPrepareResponse>(
        "/withdraw/polymarket/prepare",
        body,
      ),
  });
  const buildRelayMutation = useMutation({
    mutationFn: (body: {
      owner_address: string;
      wallet_address: string;
      bridge_address: string;
      amount: string;
    }) =>
      postPredictApi<PolymarketWithdrawRelayBuildResponse>(
        "/withdraw/polymarket/build-relay",
        body,
      ),
  });
  const submitRelayMutation = useMutation({
    mutationFn: (body: {
      owner_address: string;
      wallet_address: string;
      bridge_address: string;
      amount: string;
      nonce: string;
      deadline: string;
      signature: string;
    }) =>
      postPredictApi<PolymarketWithdrawRelaySubmitResponse>(
        "/withdraw/polymarket/submit-relay",
        body,
      ),
  });

  const { data: statusData } = useWithdrawStatusQuery({
    txHash: isSolana ? txHash : undefined,
    source,
  });
  const { data: polymarketStatus } =
    useQuery<PolymarketWithdrawBridgeStatusResponse>({
      queryKey: [
        "polymarket",
        "withdraw-status",
        bridgeAddress ?? "",
        transactionId ?? "",
      ],
      queryFn: () =>
        getPredictApi<PolymarketWithdrawBridgeStatusResponse>(
          "/withdraw/polymarket/status",
          {
            bridge_address: bridgeAddress,
            transaction_id: transactionId,
          },
        ),
      enabled: Boolean(bridgeAddress || transactionId),
      refetchInterval: (query) => {
        const data = query.state.data;
        if (
          data?.bridge_status === "completed" ||
          data?.bridge_status === "failed" ||
          data?.relayer_status === "STATE_FAILED"
        ) {
          return false;
        }
        return 3000;
      },
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

  useEffect(() => {
    if (!polymarketStatus || isSolana) return;
    const bridgeDone = polymarketStatus.bridge_status === "completed";
    const relayerDone =
      polymarketStatus.relayer_status === "STATE_CONFIRMED" ||
      polymarketStatus.relayer_status === "STATE_MINED";
    if (bridgeDone || relayerDone) {
      toast.success(t("extend.predict.fundWallet.withdrawalConfirmed"));
      if (evmAddress) {
        queryClient.invalidateQueries({
          queryKey: balanceQueryKey("polymarket", evmAddress),
        });
      }
      onClose();
    } else if (
      polymarketStatus.bridge_status === "failed" ||
      polymarketStatus.relayer_status === "STATE_FAILED"
    ) {
      toast.error(t("extend.predict.fundWallet.withdrawalFailed"));
      setBridgeAddress(undefined);
      setTransactionId(undefined);
      setIsSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polymarketStatus?.bridge_status, polymarketStatus?.relayer_status]);

  const handleMax = useCallback(() => {
    if (balance != null) {
      setAmount(formatUsdc(balance));
    }
  }, [balance]);

  const parsedAmount = parseFloat(amount.replace(/,/g, ""));
  const trimmedDest = destination.trim();
  const availableChains = useMemo(() => getWithdrawChains(), []);
  const selectedChain =
    availableChains.find((c) => c.key === selectedChainKey) ??
    availableChains[0];
  const selectedChainAssets = useMemo(
    () => getWithdrawAssetsForChain(selectedChain?.chainId),
    [selectedChain?.chainId],
  );
  const selectedAsset =
    selectedChainAssets.find((a) => bridgeAssetKey(a) === selectedAssetKey) ??
    selectedChainAssets[0];

  useEffect(() => {
    if (
      availableChains.length > 0 &&
      !availableChains.some((c) => c.key === selectedChainKey)
    ) {
      setSelectedChainKey(getDefaultDepositChainKey(availableChains));
    }
  }, [availableChains, selectedChainKey]);

  useEffect(() => {
    if (
      selectedChainAssets.length > 0 &&
      !selectedChainAssets.some((a) => bridgeAssetKey(a) === selectedAssetKey)
    ) {
      setSelectedAssetKey(bridgeAssetKey(selectedChainAssets[0]));
    }
  }, [selectedAssetKey, selectedChainAssets]);

  const chainName = isSolana ? "Solana" : selectedChain?.label ?? "Network";
  const isValidAddress = isSolana
    ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmedDest)
    : selectedChain
      ? isValidBridgeRecipient(selectedChain, trimmedDest)
      : false;

  const minWithdrawUsd = selectedAsset?.minCheckoutUsd ?? 0;
  const isBelowMinimum =
    !isSolana &&
    !isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    minWithdrawUsd > 0 &&
    parsedAmount < minWithdrawUsd;

  const balanceCents = toCents(balance ?? 0);
  const isValid =
    !isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    !isBelowMinimum &&
    toCents(parsedAmount) <= balanceCents &&
    isValidAddress &&
    fromAddress != null &&
    (isSolana || (!!selectedChain && !!selectedAsset));

  useEffect(() => {
    if (
      isSolana ||
      !isValid ||
      !evmAddress ||
      !selectedAsset ||
      !selectedChain ||
      isSubmitting
    ) {
      return;
    }
    const timer = setTimeout(() => {
      quoteMutation.mutate({
        wallet_address: evmAddress,
        amount: String(parsedAmount),
        to_chain_id: selectedChain.chainId,
        to_token_address: selectedAsset.token.address,
        recipient_address: trimmedDest,
      });
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isSolana,
    isValid,
    evmAddress,
    selectedAsset?.token.address,
    selectedChain?.chainId,
    parsedAmount,
    trimmedDest,
    isSubmitting,
  ]);

  const quote = quoteMutation.data;
  const quotePending = quoteMutation.isPending;
  const needsQuote = !isSolana;
  const canSubmit = isValid && (!needsQuote || !!quote) && !quotePending;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !fromAddress) return;
    setIsSubmitting(true);

    try {
      if (isSolana) {
        const buildResult = await buildMutation.mutateAsync({
	          source,
	          from: fromAddress,
	          to: trimmedDest,
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
        if (polymarketWalletKind === "safe") {
          throw new Error("Legacy Safe withdrawals are not supported by this flow");
        }
        if (!evmAddress || !polymarketWalletAddress || !selectedChain || !selectedAsset)
          throw new Error("wallet_not_connected");

        const evmWallet = wallets.find(
          (w) => w.chainNamespace === "EVM" && w.isConnected,
        ) as EvmWalletAdapter | undefined;
        if (!evmWallet) throw new Error("wallet_not_connected");

        await evmWallet.switchChain("137" as never);
        const provider = await evmWallet.getEip1193Provider();
        if (!provider) throw new Error("Cannot get EIP-1193 provider");

        const prepared = await prepareMutation.mutateAsync({
          wallet_address: polymarketWalletAddress,
          to_chain_id: selectedChain.chainId,
          to_token_address: selectedAsset.token.address,
          recipient_address: trimmedDest,
          quote_id: quote?.quote_id,
        });
        const nextBridgeAddress =
          prepared.bridge_address ?? prepared.deposit_address;
        if (!nextBridgeAddress) throw new Error("bridge_address_unavailable");

        const relayBuild = await buildRelayMutation.mutateAsync({
          owner_address: evmAddress,
          wallet_address: polymarketWalletAddress,
          bridge_address: nextBridgeAddress,
          amount: String(parsedAmount),
        });

        const signature = await signWithdrawRelayTypedData(
          provider,
          evmAddress as Hex,
          relayBuild.typed_data,
        );

        const result = await submitRelayMutation.mutateAsync({
          owner_address: evmAddress,
          wallet_address: polymarketWalletAddress,
          bridge_address: nextBridgeAddress,
          amount: String(parsedAmount),
          nonce: relayBuild.nonce,
          deadline: relayBuild.deadline,
          signature,
        });

        toast.success(t("extend.predict.fundWallet.txSubmitted"));
        setBridgeAddress(result.bridge_address);
        setTransactionId(result.transaction_id);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      toast.error(friendlyWithdrawError(raw, t as (key: string) => string));
      setIsSubmitting(false);
    }
  }, [
	    canSubmit,
	    fromAddress,
	    source,
	    trimmedDest,
    parsedAmount,
    isSolana,
    solanaWallet,
    evmAddress,
    polymarketWalletKind,
    polymarketWalletAddress,
    selectedChain,
    selectedAsset,
    quote?.quote_id,
    buildMutation,
    submitMutation,
    prepareMutation,
    buildRelayMutation,
    submitRelayMutation,
    wallets,
    t,
  ]);

  const isPending = isSubmitting || !!txHash || !!transactionId;
  const notAvailable = t("extend.predict.fundWallet.notAvailable");
  const receivingAmount =
    quote && selectedAsset
      ? formatBaseUnit(quote.est_to_token_base_unit, selectedAsset.token.decimals)
      : null;

  return (
    <div>
      <ModalHeader title={t("extend.predict.fundWallet.withdrawTitle")} onClose={onClose} />
      <div className="px-5 pb-5 space-y-4">
        {isSolana && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-[10px] px-3 py-2.5">
            <p className="text-xs text-amber-300 leading-relaxed">
              {t("extend.predict.fundWallet.withdrawInfo", {
                chain: chainName,
              })}
            </p>
          </div>
        )}

        {!isSolana && selectedChain && (
          <DepositChainSelect
            chains={availableChains}
            value={selectedChain.key}
            onChange={(key) => {
              setSelectedChainKey(key);
              setDestination("");
              quoteMutation.reset();
            }}
          />
        )}

        {!isSolana && selectedAsset && (
          <BridgeTokenPills
            assets={selectedChainAssets}
            value={bridgeAssetKey(selectedAsset)}
            onChange={(key) => {
              setSelectedAssetKey(key);
              quoteMutation.reset();
            }}
          />
        )}

        {!isSolana && minWithdrawUsd > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-[10px] px-3 py-2">
            <p className="text-xs text-amber-300">
              {t("extend.predict.fundWallet.withdrawInfoWithMin", {
                token: selectedAsset?.token.symbol ?? "USDC",
                chain: chainName,
                amount: formatMinAmount(minWithdrawUsd),
              })}
            </p>
          </div>
        )}

        {/* Amount input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              {t("extend.predict.fundWallet.withdrawAmount")}
            </label>
            <span className="text-xs text-zinc-400 tabular-nums">
              {t("extend.predict.fundWallet.withdrawableBalance", {
                amount: `$${formatUsdc(balance ?? 0)}`,
              })}
            </span>
          </div>
          <div className="flex items-center bg-zinc-800/50 border border-zinc-700/50 rounded-[10px] focus-within:border-[#c7ff2e]/30">
            <span className="pl-3 text-sm text-zinc-500">$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d{0,6}$/.test(v)) {
                  setAmount(v);
                  quoteMutation.reset();
                }
              }}
              disabled={isPending}
              className="flex-1 bg-transparent px-2 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none tabular-nums"
            />
            <button
              type="button"
              onClick={handleMax}
              disabled={isPending}
              className="px-2 py-1 mr-2 text-[10px] font-semibold text-[#c7ff2e] hover:text-[#c7ff2e]/80 bg-[#c7ff2e]/10 hover:bg-[#c7ff2e]/20 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              MAX
            </button>
          </div>
          {isBelowMinimum && (
            <p className="text-[10px] text-amber-300">
              {t("extend.predict.fundWallet.minWithdrawAmount", {
                amount: formatMinAmount(minWithdrawUsd),
              })}
            </p>
          )}
        </div>

        {/* Destination address input */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            {t("extend.predict.fundWallet.destinationAddress")}
          </label>
          <div
            className={cn(
              "flex items-center bg-zinc-800/50 border rounded-[10px] focus-within:border-[#c7ff2e]/30",
              trimmedDest.length > 0 && !isValidAddress
                ? "border-red-500/60 focus-within:border-red-500"
                : "border-zinc-700/50",
            )}
          >
            <input
              type="text"
              placeholder={t("extend.predict.fundWallet.addressPlaceholder", { chain: chainName })}
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                quoteMutation.reset();
              }}
              disabled={isPending}
              className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none font-mono"
            />
            <button
              type="button"
              disabled={isPending}
              onClick={async () => {
                const text = await navigator.clipboard.readText();
                setDestination(text.trim());
                quoteMutation.reset();
              }}
              className="px-2 py-1 mr-2 text-[10px] font-semibold text-[#c7ff2e] hover:text-[#c7ff2e]/80 bg-[#c7ff2e]/10 hover:bg-[#c7ff2e]/20 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              {t("extend.predict.fundWallet.paste")}
            </button>
          </div>
          {trimmedDest.length > 0 && !isValidAddress && (
            <p className="text-[10px] text-red-400">
              {t("extend.predict.fundWallet.invalidAddress", { chain: chainName })}
            </p>
          )}
        </div>

        {!isSolana && (
          <div className="rounded-[10px] border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 space-y-2">
            <QuoteRow
              label={t("extend.predict.fundWallet.youReceive")}
              value={
                isBelowMinimum
                  ? t("extend.predict.fundWallet.minWithdrawAmount", {
                      amount: formatMinAmount(minWithdrawUsd),
                    })
                  : quotePending
                  ? t("extend.predict.fundWallet.quoteLoading")
                  : receivingAmount && selectedAsset
                    ? `${receivingAmount} ${selectedAsset.token.symbol}`
                    : notAvailable
              }
            />
            <QuoteRow
              label={t("extend.predict.fundWallet.estimatedTime")}
              value={
                quote?.est_checkout_time_ms
                  ? formatDurationMs(quote.est_checkout_time_ms)
                  : notAvailable
              }
            />
            <QuoteRow
              label={t("extend.predict.fundWallet.bridgeImpact")}
              value={
                quote?.est_output_usd
                  ? `$${formatUsdc(quote.est_output_usd)}`
                  : notAvailable
              }
            />
            {quoteMutation.error && (
              <p className="text-[10px] text-red-400">
                {friendlyWithdrawError(
                  quoteMutation.error.message,
                  t as (key: string) => string,
                )}
              </p>
            )}
          </div>
        )}

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isPending}
          className={cn(
            "w-full py-3 rounded-[10px] text-sm font-semibold transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            canSubmit && !isPending
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

function bridgeAssetKey(asset: PolymarketSupportedAsset): string {
  return `${asset.chainId}:${asset.token.address.toLowerCase()}`;
}

function isPrimaryBridgeToken(asset: PolymarketSupportedAsset): boolean {
  return PRIMARY_BRIDGE_TOKEN_SYMBOLS.includes(
    asset.token.symbol.toUpperCase() as (typeof PRIMARY_BRIDGE_TOKEN_SYMBOLS)[number],
  );
}

function getWithdrawAssetsForChain(
  chainId: string | undefined,
): PolymarketSupportedAsset[] {
  if (!chainId) return [];
  const primary = STATIC_WITHDRAW_ASSETS
    .filter((a) => a.chainId === chainId && isPrimaryBridgeToken(a))
    .sort((a, b) => {
      const order = (symbol: string) =>
        PRIMARY_BRIDGE_TOKEN_SYMBOLS.indexOf(
          symbol.toUpperCase() as (typeof PRIMARY_BRIDGE_TOKEN_SYMBOLS)[number],
        );
      return order(a.token.symbol) - order(b.token.symbol);
    });
  const seen = new Set<string>();
  return primary.filter((asset) => {
    const symbol = asset.token.symbol.toUpperCase();
    if (seen.has(symbol)) return false;
    seen.add(symbol);
    return true;
  });
}

function getWithdrawChains(): DepositChainConfig[] {
  return DEPOSIT_CHAIN_ORDER.map((k) => DEPOSIT_CHAINS[k]).filter(
    (chain) => getWithdrawAssetsForChain(chain.chainId).length > 0,
  );
}

function getDefaultDepositChainKey(
  chains: DepositChainConfig[],
): DepositChainKey {
  return (
    chains.find((chain) => chain.key === DEFAULT_DEPOSIT_CHAIN_KEY)?.key ??
    chains[0]?.key ??
    DEFAULT_DEPOSIT_CHAIN_KEY
  );
}

function isValidBridgeRecipient(
  chain: DepositChainConfig,
  address: string,
): boolean {
  if (!address) return false;
  if (chain.bridgeField === "svm") {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }
  if (chain.bridgeField === "tron") {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  }
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

function formatBaseUnit(value: string, decimals: number): string {
  if (!value) return "0";
  try {
    const raw = BigInt(value);
    const base = 10n ** BigInt(decimals);
    const whole = raw / base;
    const fraction = raw % base;
    if (fraction === 0n) return whole.toString();
    const padded = fraction.toString().padStart(decimals, "0");
    const trimmed = padded.replace(/0+$/, "");
    return `${whole}.${trimmed.slice(0, 6)}`;
  } catch {
    return value;
  }
}

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const minutes = Math.max(1, Math.round(ms / 60000));
  return `~${minutes} min`;
}

/**
 * Format a Bridge `minCheckoutUsd` value for display in the deposit banner.
 *
 * Drops trailing `.00` for whole-dollar minimums (e.g. `$2` instead of `$2.00`)
 * while preserving meaningful cents (e.g. `$0.50`).
 */
function formatMinAmount(usd: number): string {
  if (Number.isInteger(usd)) return `$${usd}`;
  return `$${usd.toFixed(2)}`;
}

function formatTokenList(tokens: string[], locale?: string): string {
  if (tokens.length <= 1) return tokens[0] ?? "";
  try {
    return new Intl.ListFormat(locale, {
      style: "long",
      type: "disjunction",
    }).format(tokens);
  } catch {
    return tokens.join(" / ");
  }
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
