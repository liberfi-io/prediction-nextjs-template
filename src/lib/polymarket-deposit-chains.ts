/**
 * Static configuration for the Polymarket Bridge deposit chain selector.
 *
 * The Polymarket Bridge returns a single `evm` address that is reused across
 * every supported EVM network (Ethereum / Polygon / BNB / Base / Arbitrum /
 * Optimism / ...). On the UI we expand this into individual chain options
 * so users see the network they actually want to send from, with the right
 * block-explorer link.
 *
 * Non-EVM chains (Solana) point at their own bridge field (`svm`).
 *
 * Chain IDs mirror the Polymarket Bridge `/supported-assets` response:
 *   - EVM chains use the canonical decimal chain ID as a string.
 *   - Solana uses `"solana"`.
 * If the upstream `supported-assets` list doesn't include a `chainId` listed
 * here, that chain is hidden from the picker (server is the source of truth
 * for what the bridge actually accepts).
 */

export type DepositChainKey =
  | "solana"
  | "ethereum"
  | "base"
  | "polygon"
  | "bnb"
  | "tron";

export type BridgeAddressField = "evm" | "svm" | "tron";

export interface DepositChainConfig {
  key: DepositChainKey;
  /** Matches `chainId` from Polymarket Bridge `/supported-assets`. */
  chainId: string;
  /** Display name surfaced in the picker and copy text. */
  label: string;
  /** Which field of `PolymarketDepositAddresses` to render for this chain. */
  bridgeField: BridgeAddressField;
  /**
   * Native gas-token symbol of this chain, displayed as a "supported" chip
   * regardless of whether the bridge accepts it for deposit. We surface it
   * because users typically need a small native balance for gas (e.g. ETH
   * for Ethereum, SOL for Solana).
   */
  nativeSymbol: string;
  /** Block-explorer human-readable name (e.g. "Etherscan"). */
  explorerName: string;
  /** Builds the block-explorer URL for the bridge deposit address on this chain. */
  buildExplorerUrl: (bridgeAddress: string) => string;
}

export const DEPOSIT_CHAINS: Record<DepositChainKey, DepositChainConfig> = {
  solana: {
    key: "solana",
    /**
     * Polymarket Bridge uses its own internal numeric ID for Solana — confirmed
     * empirically from `/supported-assets` (Solana = `"1151111081099710"`). It
     * is NOT the chain's network ID (Solana has no on-chain ID), and not the
     * literal string "solana".
     */
    chainId: "1151111081099710",
    label: "Solana",
    bridgeField: "svm",
    nativeSymbol: "SOL",
    explorerName: "Solscan",
    buildExplorerUrl: (addr) => `https://solscan.io/account/${addr}`,
  },
  ethereum: {
    key: "ethereum",
    chainId: "1",
    label: "Ethereum",
    bridgeField: "evm",
    nativeSymbol: "ETH",
    explorerName: "Etherscan",
    buildExplorerUrl: (addr) => `https://etherscan.io/address/${addr}`,
  },
  base: {
    key: "base",
    chainId: "8453",
    label: "Base",
    bridgeField: "evm",
    nativeSymbol: "ETH",
    explorerName: "Basescan",
    buildExplorerUrl: (addr) => `https://basescan.org/address/${addr}`,
  },
  polygon: {
    key: "polygon",
    chainId: "137",
    label: "Polygon",
    bridgeField: "evm",
    nativeSymbol: "POL",
    explorerName: "Polygonscan",
    buildExplorerUrl: (addr) => `https://polygonscan.com/address/${addr}`,
  },
  bnb: {
    key: "bnb",
    chainId: "56",
    label: "BNB Chain",
    bridgeField: "evm",
    nativeSymbol: "BNB",
    explorerName: "BscScan",
    buildExplorerUrl: (addr) => `https://bscscan.com/address/${addr}`,
  },
  tron: {
    key: "tron",
    /**
     * Polymarket Bridge uses its own internal numeric ID for Tron — confirmed
     * empirically from `/supported-assets` (Tron = `"728126428"`). The bridge
     * only accepts USDT (TRC20) on Tron, with a higher minimum deposit.
     */
    chainId: "728126428",
    label: "Tron",
    bridgeField: "tron",
    nativeSymbol: "TRX",
    explorerName: "Tronscan",
    buildExplorerUrl: (addr) => `https://tronscan.org/#/address/${addr}`,
  },
};

/**
 * Default display order in the picker. Solana first (cheapest gas + most
 * common for our user base), then ETH / Polygon / BNB.
 */
export const DEPOSIT_CHAIN_ORDER: DepositChainKey[] = [
  "solana",
  "ethereum",
  "base",
  "polygon",
  "bnb",
  "tron",
];
