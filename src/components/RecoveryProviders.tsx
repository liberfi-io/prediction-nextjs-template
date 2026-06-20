"use client";

/**
 * Isolated Privy provider for the wallet recovery flow.
 *
 * Deliberately a RAW `@privy-io/react-auth` provider (not the app's
 * `PrivyWalletConnectorProvider`), with its own config:
 * - `loginMethods: ["telegram"]` so a legacy user re-authenticates against
 *   their ORIGINAL native-Telegram Privy user (seamless Mini App login), not
 *   the custom-JWT user the main app creates.
 * - No `exchangeAccessToken`: recovery never needs a LiberFi backend session,
 *   only the Privy client `addSigners` call.
 * - `createOnLogin: "off"`: never mint a new wallet; we only load the legacy
 *   embedded wallet that already holds the Polymarket deposit balance.
 *
 * This provider is mounted ONLY under the `(recovery)` route group, so the
 * custom-JWT auto-login from the main app's `AppLayout` is never present here.
 */

import { PropsWithChildren } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

export function RecoveryProviders({ children }: PropsWithChildren) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APPID!}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#BCFF2E",
          logo: "/brand.png",
        },
        loginMethods: ["telegram"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "off",
          },
          solana: {
            createOnLogin: "off",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
