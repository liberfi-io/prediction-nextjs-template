"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import {
  useLinkJwtAccount,
  useLoginWithTelegram,
  useSigners,
  useSyncJwtBasedAuthState,
} from "@privy-io/react-auth";
import { ChainNamespace } from "@liberfi.io/types";
import { useAuth, useWallets } from "@liberfi.io/wallet-connector";
import {
  fetchTelegramMiniAppBootstrap,
  getTelegramExternalJwt,
  type TelegramMiniAppBootstrap,
} from "src/features/telegram-miniapp/autoLogin";
import {
  getTelegramWebApp,
  isLikelyTelegramMiniAppLaunch,
  readTelegramInitData,
} from "src/features/telegram-miniapp/launchParams";
import { telegramMiniAppAutoLoginPendingAtom } from "src/features/telegram-miniapp/state";
import { usePrivySessionSignerProvisioning } from "src/features/privy-session-signers/usePrivySessionSignerProvisioning";

const TELEGRAM_DETECTION_TIMEOUT_MS = 5000;
const TELEGRAM_DETECTION_INTERVAL_MS = 100;
const JWT_RESYNC_INTERVAL_MS = 60 * 1000;

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
  const [legacyLoginFailed, setLegacyLoginFailed] = useState(false);
  const { login: loginWithTelegram } = useLoginWithTelegram();
  const { linkWithCustomJwt } = useLinkJwtAccount();
  const legacyLoginTriggeredRef = useRef(false);
  const legacyLinkAttemptedRef = useRef(false);

  useEffect(() => {
    if (isLikelyTelegramMiniAppLaunch()) {
      setIsTelegramLaunch(true);
      setDetectionComplete(true);
      setAutoLoginPending(true);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (getTelegramWebApp() || readTelegramInitData()) {
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
    if (!isTelegramLaunch || !detectionComplete || bootstrap || bootstrapLoading) {
      return;
    }

    let cancelled = false;
    setBootstrapLoading(true);
    void fetchTelegramMiniAppBootstrap()
      .then((result) => {
        if (cancelled) return;
        setBootstrap(result ?? { mode: "unsupported", reason: "BOOTSTRAP_FAILED" });
      })
      .finally(() => {
        if (!cancelled) setBootstrapLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bootstrap, bootstrapLoading, detectionComplete, isTelegramLaunch]);

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
    onError: (error) => {
      console.warn("telegram privy jwt auth failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    },
  });

  // Legacy native Telegram user: auto-trigger a one-time native login so we can
  // attach custom_auth in place afterwards. Only this component initiates login,
  // and only in the legacy branch, so it never races the custom_jwt flow.
  useEffect(() => {
    if (bootstrap?.mode !== "legacy_native_telegram") return;
    if (legacyLoginTriggeredRef.current) return;
    if (status === "authenticated" || status === "authenticating") return;

    legacyLoginTriggeredRef.current = true;
    void loginWithTelegram().catch((error: unknown) => {
      console.warn("telegram legacy native login failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      setLegacyLoginFailed(true);
    });
  }, [bootstrap, loginWithTelegram, status]);

  // Once the legacy user is authenticated natively, silently attach the
  // custom_auth account so future cold starts go through seamless custom JWT.
  useEffect(() => {
    if (bootstrap?.mode !== "legacy_native_telegram") return;
    if (status !== "authenticated" || !user?.id) return;
    if (legacyLinkAttemptedRef.current) return;

    const { linkToken, telegramUserId } = bootstrap;
    const storageKey = `telegram-link:${telegramUserId}:${user.id}`;
    if (localStorage.getItem(storageKey) === "done") {
      legacyLinkAttemptedRef.current = true;
      return;
    }

    legacyLinkAttemptedRef.current = true;
    void linkWithCustomJwt(linkToken)
      .then(() => localStorage.setItem(storageKey, "done"))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (/already|linked|exists/i.test(message)) {
          localStorage.setItem(storageKey, "done");
          return;
        }
        console.warn("telegram legacy custom auth link failed", { message });
      });
  }, [bootstrap, linkWithCustomJwt, status, user?.id]);

  useEffect(() => {
    if (!isTelegramLaunch) {
      setAutoLoginPending(false);
      return;
    }

    if (bootstrap?.mode === "unsupported") {
      setAutoLoginPending(false);
      return;
    }

    if (status === "authenticated") {
      setAutoLoginPending(false);
      return;
    }

    if (bootstrap?.mode === "legacy_native_telegram") {
      setAutoLoginPending(!legacyLoginFailed);
      return;
    }

    setAutoLoginPending(
      bootstrapLoading ||
        !bootstrap ||
        jwtAuth.state.status === "initial" ||
        jwtAuth.state.status === "loading",
    );
  }, [
    bootstrap,
    bootstrapLoading,
    isTelegramLaunch,
    jwtAuth.state.status,
    legacyLoginFailed,
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
