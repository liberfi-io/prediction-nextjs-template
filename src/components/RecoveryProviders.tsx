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
 *
 * Launch-hash gate: Privy's seamless Telegram login reads ONLY
 * `window.location.hash` (it must start with `#tgWebAppData=`); it never reads
 * `window.Telegram.WebApp.initData`. On iOS Telegram the launch payload arrives
 * through the native bridge into `WebApp.initData` with NO URL hash, so we
 * synthesize the canonical hash here and gate the PrivyProvider mount until it
 * is present — Privy's seamless detection runs once at mount, so the hash must
 * exist before that.
 */

import { PropsWithChildren, useEffect, useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { Spinner } from "@liberfi.io/ui";

const LAUNCH_HASH_TIMEOUT_MS = 5000;
const LAUNCH_HASH_INTERVAL_MS = 50;

function hasLaunchHash(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hash.startsWith("#tgWebAppData")
  );
}

/**
 * Ensure `window.location.hash` carries the Telegram launch payload in the
 * shape Privy expects (`#tgWebAppData=<encodeURIComponent(initData)>`).
 * Returns true once the hash is present (already there or just synthesized).
 */
function ensureLaunchHash(): boolean {
  if (typeof window === "undefined") return false;
  if (hasLaunchHash()) return true;

  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) return false;

  const url = `${window.location.pathname}${window.location.search}#tgWebAppData=${encodeURIComponent(initData)}`;
  window.history.replaceState(null, "", url);
  return true;
}

function RecoverySplash() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0b]">
      <Spinner size="md" />
    </div>
  );
}

export function RecoveryProviders({ children }: PropsWithChildren) {
  // Gate Privy's mount until the launch hash exists. Start `false` (matching
  // SSR) and flip in an effect only, so there is no hydration mismatch.
  const [hashReady, setHashReady] = useState(false);

  useEffect(() => {
    if (ensureLaunchHash()) {
      setHashReady(true);
      return;
    }
    // initData is populated by telegram-web-app.js (loaded afterInteractive),
    // so poll briefly until it lands, then give up and mount anyway.
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (
        ensureLaunchHash() ||
        Date.now() - startedAt >= LAUNCH_HASH_TIMEOUT_MS
      ) {
        window.clearInterval(timer);
        setHashReady(true);
      }
    }, LAUNCH_HASH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  if (!hashReady) return <RecoverySplash />;

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
