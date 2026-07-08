"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import { useSigners, useSyncJwtBasedAuthState } from "@privy-io/react-auth";
import { ChainNamespace } from "@liberfi.io/types";
import { useAuth, useWallets } from "@liberfi.io/wallet-connector";
import {
  fetchTelegramMiniAppBootstrap,
  getTelegramExternalJwt,
  type TelegramMiniAppBootstrap,
} from "src/features/telegram-miniapp/autoLogin";
import {
  isLikelyTelegramMiniAppLaunch,
  readTelegramInitData,
} from "src/features/telegram-miniapp/launchParams";
import { telegramMiniAppAutoLoginPendingAtom } from "src/features/telegram-miniapp/state";
import { usePrivySessionSignerProvisioning } from "src/features/privy-session-signers/usePrivySessionSignerProvisioning";

const TELEGRAM_DETECTION_TIMEOUT_MS = 5000;
const TELEGRAM_DETECTION_INTERVAL_MS = 100;
const JWT_RESYNC_INTERVAL_MS = 60 * 1000;
const BOOTSTRAP_RETRY_DELAYS_MS = [0, 500, 1500, 3000, 5000] as const;

export function TelegramPrivyAutoLogin() {
  const { status, user } = useAuth();
  const wallets = useWallets();
  const { addSigners } = useSigners();
  const [, setAutoLoginPending] = useAtom(telegramMiniAppAutoLoginPendingAtom);
  const [isTelegramLaunch, setIsTelegramLaunch] = useState(() =>
    isLikelyTelegramMiniAppLaunch(),
  );
  const [detectionComplete, setDetectionComplete] = useState(false);
  const [bootstrap, setBootstrap] = useState<TelegramMiniAppBootstrap | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const bootstrapStartedRef = useRef(false);

  useEffect(() => {
    if (isLikelyTelegramMiniAppLaunch()) {
      setIsTelegramLaunch(true);
      setDetectionComplete(true);
      setAutoLoginPending(true);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (readTelegramInitData() || isLikelyTelegramMiniAppLaunch()) {
        setIsTelegramLaunch(true);
        setDetectionComplete(true);
        setAutoLoginPending(true);
        window.clearInterval(interval);
        return;
      }

      if (Date.now() - startedAt >= TELEGRAM_DETECTION_TIMEOUT_MS) {
        setIsTelegramLaunch(false);
        setDetectionComplete(true);
        setAutoLoginPending(false);
        window.clearInterval(interval);
      }
    }, TELEGRAM_DETECTION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [setAutoLoginPending]);

  useEffect(() => {
    if (!isTelegramLaunch || !detectionComplete) return;
    // Fire exactly once via a ref guard. Do NOT gate on `bootstrapLoading`
    // state here: toggling it inside an effect that also depends on it triggers
    // a re-render whose cleanup cancels the in-flight fetch, deadlocking with
    // `bootstrapLoading` stuck true and `bootstrap` stuck null.
    if (bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;

    let cancelled = false;
    setBootstrapLoading(true);
    console.info("[tg-login] bootstrap fetch start");
    void (async () => {
      for (let attempt = 0; attempt < BOOTSTRAP_RETRY_DELAYS_MS.length; attempt += 1) {
        const delay = BOOTSTRAP_RETRY_DELAYS_MS[attempt];
        if (delay > 0) {
          await sleep(delay);
        }
        if (cancelled) return;

        const result = await fetchTelegramMiniAppBootstrap();
        if (cancelled) return;
        if (result?.mode === "custom_jwt" || result?.reason === "TELEGRAM_LOGIN_NOT_CONFIGURED") {
          console.info("[tg-login] bootstrap result", {
            mode: result.mode,
            reason: "reason" in result ? result.reason : undefined,
            attempt: attempt + 1,
          });
          setBootstrap(result);
          setBootstrapLoading(false);
          return;
        }
        console.info("[tg-login] bootstrap retry", {
          attempt: attempt + 1,
          mode: result?.mode,
          reason: result && "reason" in result ? result.reason : undefined,
        });
      }

      if (cancelled) return;
      const failed = { mode: "unsupported" as const, reason: "BOOTSTRAP_FAILED" };
      console.info("[tg-login] bootstrap result", failed);
      setBootstrap(failed);
      setBootstrapLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [detectionComplete, isTelegramLaunch]);

  const jwtAuthEnabled =
    isTelegramLaunch &&
    detectionComplete &&
    bootstrap?.mode === "custom_jwt";

  const subscribe = useCallback((onStoreChange: () => void) => {
    const interval = window.setInterval(onStoreChange, JWT_RESYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const jwtAuth = useSyncJwtBasedAuthState({
    enabled: jwtAuthEnabled,
    subscribe,
    getExternalJwt: getTelegramExternalJwt,
    onAuthenticated: () => {
      console.info("[tg-login] jwt onAuthenticated");
    },
    onUnauthenticated: () => {
      console.info("[tg-login] jwt onUnauthenticated");
    },
    onError: (error) => {
      console.warn("[tg-login] jwt auth failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    },
  });

  useEffect(() => {
    console.info("[tg-login] jwtAuth state", {
      enabled: jwtAuthEnabled,
      jwtState: jwtAuth.state.status,
      authStatus: status,
      userId: user?.id ?? null,
    });
  }, [jwtAuthEnabled, jwtAuth.state.status, status, user?.id]);

  useEffect(() => {
    if (!isTelegramLaunch) {
      setAutoLoginPending(false);
      return;
    }

    if (bootstrap?.mode === "unsupported") {
      console.info("[tg-login] pending=false (unsupported)");
      setAutoLoginPending(false);
      return;
    }

    if (status === "authenticated") {
      console.info("[tg-login] pending=false (authenticated)");
      setAutoLoginPending(false);
      return;
    }

    const pending =
      bootstrapLoading ||
      !bootstrap ||
      jwtAuth.state.status === "initial" ||
      jwtAuth.state.status === "loading";
    console.info("[tg-login] pending compute", {
      pending,
      bootstrapLoading,
      hasBootstrap: Boolean(bootstrap),
      jwtState: jwtAuth.state.status,
      authStatus: status,
    });
    setAutoLoginPending(pending);
  }, [
    bootstrap,
    bootstrapLoading,
    isTelegramLaunch,
    jwtAuth.state.status,
    setAutoLoginPending,
    status,
  ]);

  const telegramSignerNamespaces = useMemo(
    () => [ChainNamespace.EVM, ChainNamespace.SOLANA],
    [],
  );
  usePrivySessionSignerProvisioning({
    enabled: isTelegramLaunch && status === "authenticated",
    storagePrefix: "telegram-session-signer",
    userId: user?.id,
    wallets,
    chainNamespaces: telegramSignerNamespaces,
    addSigners,
  });

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
