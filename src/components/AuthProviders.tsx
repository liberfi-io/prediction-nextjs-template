"use client";

import { PropsWithChildren, useCallback } from "react";
import { mainnet, bsc, polygon } from "viem/chains";
import {
  PrivyAuthProvider,
  PrivyWalletConnectorProvider,
} from "@liberfi.io/wallet-connector-privy";
import { authenticatePrivy } from "../libs/authenticatePrivy";

export function AuthProviders({ children }: PropsWithChildren) {
  const exchangeAccessToken = useCallback(async (accessToken: string, identityToken: string) => {
    const result = await authenticatePrivy({
      accessToken,
      identityToken,
    });
    return result.token;
  }, []);

  return (
    <PrivyWalletConnectorProvider
      privyAppId={process.env.NEXT_PUBLIC_PRIVY_APPID!}
      privyClientConfig={{
        defaultChain: mainnet,
        supportedChains: [mainnet, bsc, polygon],
        appearance: {
          theme: "dark",
          accentColor: "#BCFF2E",
          logo: "/brand.png",
          landingHeader: "Sign in or sign up to Liberfi",
          walletList: [
            "phantom",
            "metamask",
            "okx_wallet",
            "rainbow",
            "solflare",
            "backpack",
            "wallet_connect",
            "detected_ethereum_wallets",
            "detected_solana_wallets",
          ],
          walletChainType: "ethereum-and-solana",
        },
        loginMethods: [
          "email",
          "google",
          "twitter",
          "discord",
          "github",
          "wallet",
          "telegram"
        ],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <PrivyAuthProvider exchangeAccessToken={exchangeAccessToken}>{children}</PrivyAuthProvider>
    </PrivyWalletConnectorProvider>
  );
}
