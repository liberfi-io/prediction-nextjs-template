/**
 * Lightweight Polymarket Relay Client built on viem.
 * Handles Safe deployment, token approvals, and Safe transactions via the
 * Polymarket Relayer v2 API without importing ethers.
 *
 * HMAC authentication is delegated to the backend signing proxy endpoint
 * (POST /api/v1/polymarket/sign) which keeps Builder API credentials server-side.
 */

import {
  type Hex,
  type WalletClient,
  type PublicClient,
  keccak256,
  encodePacked,
  encodeAbiParameters,
  getCreate2Address,
  hashTypedData,
  encodeFunctionData,
  size,
  concatHex,
  zeroAddress,
  hexToBigInt,
  createPublicClient,
  http,
} from "viem";
import { polygon } from "viem/chains";

// ---------------------------------------------------------------------------
// Constants (from @polymarket/builder-relayer-client)
// ---------------------------------------------------------------------------

const SAFE_INIT_CODE_HASH: Hex =
  "0x2bce2127ff07fb632d16c8347c4ebf501f4841168bed00d9e6ef715ddb6fcecf";

const SAFE_FACTORY: Hex =
  "0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b";

const SAFE_MULTISEND: Hex =
  "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761";

const SAFE_FACTORY_NAME = "Polymarket Contract Proxy Factory";

const POLYGON_CHAIN_ID = 137;

const RELAYER_URL = "https://relayer-v2.polymarket.com";

const multisendAbi = [
  {
    inputs: [{ name: "transactions", type: "bytes" }],
    name: "multiSend",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RelayerHeaders {
  POLY_BUILDER_SIGNATURE: string;
  POLY_BUILDER_TIMESTAMP: string;
  POLY_BUILDER_API_KEY: string;
  POLY_BUILDER_PASSPHRASE: string;
}

interface SafeTransaction {
  to: Hex;
  data: Hex;
  value: string;
  operation: number; // 0 = Call, 1 = DelegateCall
}

interface RelayerSubmitResponse {
  transactionID: string;
  state: string;
}

export interface PolymarketRelayConfig {
  /** URL of the backend HMAC signing proxy, e.g. "/predict-api/api/v1/polymarket/sign" */
  signProxyUrl: string;
}

// ---------------------------------------------------------------------------
// Derive Safe address
// ---------------------------------------------------------------------------

export function deriveSafe(ownerAddress: Hex): Hex {
  return getCreate2Address({
    bytecodeHash: SAFE_INIT_CODE_HASH,
    from: SAFE_FACTORY,
    salt: keccak256(
      encodeAbiParameters(
        [{ name: "address", type: "address" }],
        [ownerAddress],
      ),
    ),
  });
}

// ---------------------------------------------------------------------------
// HMAC signing proxy
// ---------------------------------------------------------------------------

async function getRelayerHeaders(
  config: PolymarketRelayConfig,
  method: string,
  path: string,
  body?: string,
): Promise<RelayerHeaders> {
  const resp = await fetch(config.signProxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, path, body: body ?? "" }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Signing proxy error ${resp.status}: ${text}`);
  }

  return resp.json();
}

async function relayerFetch(
  config: PolymarketRelayConfig,
  method: string,
  path: string,
  body?: string,
): Promise<Response> {
  const headers = await getRelayerHeaders(config, method, path, body);
  const url = RELAYER_URL + path;

  const fetchHeaders: Record<string, string> = {
    POLY_BUILDER_API_KEY: headers.POLY_BUILDER_API_KEY,
    POLY_BUILDER_TIMESTAMP: headers.POLY_BUILDER_TIMESTAMP,
    POLY_BUILDER_PASSPHRASE: headers.POLY_BUILDER_PASSPHRASE,
    POLY_BUILDER_SIGNATURE: headers.POLY_BUILDER_SIGNATURE,
  };
  if (body) {
    fetchHeaders["Content-Type"] = "application/json";
  }

  return fetch(url, {
    method,
    headers: fetchHeaders,
    body: body ?? undefined,
  });
}

// ---------------------------------------------------------------------------
// Relayer helpers
// ---------------------------------------------------------------------------

const safeNonceAbi = [
  {
    inputs: [],
    name: "nonce",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

let _publicClient: PublicClient | undefined;
function getPublicClient(): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: polygon,
      transport: http(),
    });
  }
  return _publicClient;
}

async function getNonce(
  _config: PolymarketRelayConfig,
  safeAddress: Hex,
): Promise<string> {
  const client = getPublicClient();
  const nonce = await client.readContract({
    address: safeAddress,
    abi: safeNonceAbi,
    functionName: "nonce",
  });
  return nonce.toString();
}

async function checkDeployed(
  config: PolymarketRelayConfig,
  safeAddress: string,
): Promise<boolean> {
  const path = `/deployed?address=${safeAddress}`;
  const resp = await relayerFetch(config, "GET", path);
  if (!resp.ok) return false;
  const data: { deployed: boolean } = await resp.json();
  return data.deployed;
}

async function submitTransaction(
  config: PolymarketRelayConfig,
  requestPayload: string,
): Promise<RelayerSubmitResponse> {
  const path = "/submit";
  const resp = await relayerFetch(config, "POST", path, requestPayload);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Relayer submit error ${resp.status}: ${text}`);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// EIP-712 Signing
// ---------------------------------------------------------------------------

function splitAndPackSig(sig: string): Hex {
  let sigV = parseInt(sig.slice(-2), 16);
  switch (sigV) {
    case 0:
    case 1:
      sigV += 31;
      break;
    case 27:
    case 28:
      sigV += 4;
      break;
    default:
      throw new Error("Invalid signature v value");
  }
  sig = sig.slice(0, -2) + sigV.toString(16);

  const r = hexToBigInt(("0x" + sig.slice(2, 66)) as Hex);
  const s = hexToBigInt(("0x" + sig.slice(66, 130)) as Hex);
  const v = parseInt(sig.slice(130, 132), 16);

  return encodePacked(
    ["uint256", "uint256", "uint8"],
    [r, s, v],
  );
}

// ---------------------------------------------------------------------------
// Safe deployment
// ---------------------------------------------------------------------------

export async function deploySafe(
  walletClient: WalletClient,
  config: PolymarketRelayConfig,
): Promise<RelayerSubmitResponse> {
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No account in WalletClient");

  const safeAddress = deriveSafe(account);

  const deployed = await checkDeployed(config, safeAddress);
  if (deployed) {
    return { transactionID: "", state: "ALREADY_DEPLOYED" };
  }

  const sig = await walletClient.signTypedData({
    account,
    domain: {
      name: SAFE_FACTORY_NAME,
      chainId: BigInt(POLYGON_CHAIN_ID),
      verifyingContract: SAFE_FACTORY,
    },
    types: {
      CreateProxy: [
        { name: "paymentToken", type: "address" },
        { name: "payment", type: "uint256" },
        { name: "paymentReceiver", type: "address" },
      ],
    },
    primaryType: "CreateProxy",
    message: {
      paymentToken: zeroAddress,
      payment: 0n,
      paymentReceiver: zeroAddress,
    },
  });

  const request = {
    from: account,
    to: SAFE_FACTORY,
    proxyWallet: safeAddress,
    data: "0x",
    signature: sig,
    signatureParams: {
      paymentToken: zeroAddress,
      payment: "0",
      paymentReceiver: zeroAddress,
    },
    type: "SAFE-CREATE",
  };

  return submitTransaction(config, JSON.stringify(request));
}

// ---------------------------------------------------------------------------
// Safe transaction execution (approve, transfer, etc.)
// ---------------------------------------------------------------------------

function aggregateTransactions(txns: SafeTransaction[]): SafeTransaction {
  if (txns.length === 1) return txns[0];

  const encoded = concatHex(
    txns.map((tx) =>
      encodePacked(
        ["uint8", "address", "uint256", "uint256", "bytes"],
        [
          tx.operation,
          tx.to,
          BigInt(tx.value),
          BigInt(size(tx.data)),
          tx.data,
        ],
      ),
    ),
  );

  const data = encodeFunctionData({
    abi: multisendAbi,
    functionName: "multiSend",
    args: [encoded],
  });

  return {
    to: SAFE_MULTISEND,
    value: "0",
    data,
    operation: 1, // DelegateCall
  };
}

export async function executeSafe(
  walletClient: WalletClient,
  txns: Array<{ to: Hex; data: Hex }>,
  config: PolymarketRelayConfig,
): Promise<RelayerSubmitResponse> {
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No account in WalletClient");

  const safeAddress = deriveSafe(account);

  const safeTxns: SafeTransaction[] = txns.map((t) => ({
    to: t.to,
    data: t.data,
    value: "0",
    operation: 0, // Call
  }));

  const transaction = aggregateTransactions(safeTxns);

  const nonce = await getNonce(config, safeAddress);

  const structHash = hashTypedData({
    primaryType: "SafeTx",
    domain: {
      chainId: POLYGON_CHAIN_ID,
      verifyingContract: safeAddress,
    },
    types: {
      SafeTx: [
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
        { name: "operation", type: "uint8" },
        { name: "safeTxGas", type: "uint256" },
        { name: "baseGas", type: "uint256" },
        { name: "gasPrice", type: "uint256" },
        { name: "gasToken", type: "address" },
        { name: "refundReceiver", type: "address" },
        { name: "nonce", type: "uint256" },
      ],
    },
    message: {
      to: transaction.to,
      value: BigInt(transaction.value),
      data: transaction.data,
      operation: transaction.operation,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: zeroAddress,
      refundReceiver: zeroAddress,
      nonce: BigInt(nonce),
    },
  });

  const rawSig = await walletClient.signMessage({
    account,
    message: { raw: structHash as Hex },
  });

  const packedSig = splitAndPackSig(rawSig);

  const request = {
    from: account,
    to: transaction.to,
    proxyWallet: safeAddress,
    data: transaction.data,
    nonce,
    signature: packedSig,
    signatureParams: {
      gasPrice: "0",
      operation: `${transaction.operation}`,
      safeTxnGas: "0",
      baseGas: "0",
      gasToken: zeroAddress,
      refundReceiver: zeroAddress,
    },
    type: "SAFE",
  };

  return submitTransaction(config, JSON.stringify(request));
}

// ---------------------------------------------------------------------------
// Poll transaction until state
// ---------------------------------------------------------------------------

export async function pollTransaction(
  config: PolymarketRelayConfig,
  transactionId: string,
  targetStates: string[] = ["STATE_MINED", "STATE_CONFIRMED"],
  failState = "STATE_FAILED",
  maxPolls = 30,
  intervalMs = 2000,
): Promise<string> {
  for (let i = 0; i < maxPolls; i++) {
    const path = `/transaction?id=${transactionId}`;
    const resp = await relayerFetch(config, "GET", path);
    if (resp.ok) {
      const txns = await resp.json();
      if (Array.isArray(txns) && txns.length > 0) {
        const tx = txns[0];
        if (targetStates.includes(tx.state)) return tx.state;
        if (tx.state === failState) {
          throw new Error(
            `Transaction failed: ${transactionId} — ${tx.errorMsg || "unknown error"}`,
          );
        }
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Transaction polling timed out: ${transactionId}`);
}

// ---------------------------------------------------------------------------
// Approval calldata helpers
// ---------------------------------------------------------------------------

const MAX_UINT256 =
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;

export function buildApproveCalldata(spender: Hex): Hex {
  return encodeFunctionData({
    abi: [
      {
        name: "approve",
        type: "function",
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
      },
    ] as const,
    functionName: "approve",
    args: [spender, MAX_UINT256],
  });
}

export function buildSetApprovalForAllCalldata(operator: Hex): Hex {
  return encodeFunctionData({
    abi: [
      {
        name: "setApprovalForAll",
        type: "function",
        inputs: [
          { name: "operator", type: "address" },
          { name: "approved", type: "bool" },
        ],
        outputs: [],
      },
    ] as const,
    functionName: "setApprovalForAll",
    args: [operator, true],
  });
}

// Polymarket contract addresses on Polygon mainnet
export const POLYMARKET_CONTRACTS = {
  USDC_E: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as Hex,
  CTF_EXCHANGE: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as Hex,
  NEG_RISK_EXCHANGE: "0xC5d563A36AE78145C45a50134d48A1215220f80a" as Hex,
  CTF: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045" as Hex,
  NEG_RISK_ADAPTER: "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296" as Hex,
} as const;

/**
 * Returns all 7 approval transactions needed for Polymarket trading:
 * - 4x ERC-20 approve(USDC.e → CTF, CTFExchange, NegRiskExchange, NegRiskAdapter)
 * - 3x ERC-1155 setApprovalForAll(CTF → CTFExchange, NegRiskExchange, NegRiskAdapter)
 */
export function buildAllApprovalTxns(): Array<{ to: Hex; data: Hex }> {
  const { USDC_E, CTF, CTF_EXCHANGE, NEG_RISK_EXCHANGE, NEG_RISK_ADAPTER } =
    POLYMARKET_CONTRACTS;

  return [
    { to: USDC_E, data: buildApproveCalldata(CTF) },
    { to: USDC_E, data: buildApproveCalldata(CTF_EXCHANGE) },
    { to: USDC_E, data: buildApproveCalldata(NEG_RISK_EXCHANGE) },
    { to: USDC_E, data: buildApproveCalldata(NEG_RISK_ADAPTER) },
    { to: CTF, data: buildSetApprovalForAllCalldata(CTF_EXCHANGE) },
    { to: CTF, data: buildSetApprovalForAllCalldata(NEG_RISK_EXCHANGE) },
    { to: CTF, data: buildSetApprovalForAllCalldata(NEG_RISK_ADAPTER) },
  ];
}

/**
 * Builds a USDC.e transfer transaction for withdrawals.
 */
export function buildTransferCalldata(to: Hex, amount: bigint): Hex {
  return encodeFunctionData({
    abi: [
      {
        name: "transfer",
        type: "function",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
      },
    ] as const,
    functionName: "transfer",
    args: [to, amount],
  });
}
