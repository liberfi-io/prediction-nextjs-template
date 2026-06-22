"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { useSigners, useSyncJwtBasedAuthState } from "@privy-io/react-auth";
import { ChainNamespace } from "@liberfi.io/types";
import { useAuth, useWallets } from "@liberfi.io/wallet-connector";
import { getMpChatExternalJwt } from "src/features/mpchat-miniapp/autoLogin";
import {
  getMpChatWebApp,
  isLikelyMpChatLaunch,
  isMpChatMiniAppEnabled,
  readMpChatInitData,
} from "src/features/mpchat-miniapp/launchParams";
import {
  readTelegramInitData,
} from "src/features/telegram-miniapp/launchParams";
import { mpChatAutoLoginPendingAtom } from "src/features/mpchat-miniapp/state";
import { usePrivySessionSignerProvisioning } from "src/features/privy-session-signers/usePrivySessionSignerProvisioning";

const MPCHAT_DETECTION_TIMEOUT_MS = 5000;
const MPCHAT_DETECTION_INTERVAL_MS = 100;
const JWT_RESYNC_INTERVAL_MS = 60 * 1000;

/**
 * Strong Telegram Mini App signal. MPChat and Telegram share loose launch hints
 * (e.g. `startapp`, an injected `JSBridge`), so MPChat auto-login can misfire
 * inside a genuine Telegram launch and hammer `/api/auth/mpchat-miniapp/login`
 * with no MPChat session (401), pinning the loading spinner. When Telegram
 * initData is present we are unambiguously in a Telegram launch, so MPChat must
 * stand down and let `TelegramPrivyAutoLogin` own login.
 */
function isTelegramMiniAppLaunch(): boolean {
  return Boolean(readTelegramInitData());
}

export function MpChatPrivyAutoLogin() {
  const { status, user } = useAuth();
  const wallets = useWallets();
  const { addSigners } = useSigners();
  const [, setAutoLoginPending] = useAtom(mpChatAutoLoginPendingAtom);
  const [isMpChatLaunch, setIsMpChatLaunch] = useState(
    () => isLikelyMpChatLaunch() && !isTelegramMiniAppLaunch(),
  );
  const [detectionComplete, setDetectionComplete] = useState(() => !isMpChatMiniAppEnabled());

  useEffect(() => {
    if (!isMpChatMiniAppEnabled()) {
      setIsMpChatLaunch(false);
      setDetectionComplete(true);
      setAutoLoginPending(false);
      return;
    }

    // Telegram launch wins: never run the MPChat flow alongside Telegram, or its
    // sessionless login attempt 401s and traps the spinner.
    if (isTelegramMiniAppLaunch()) {
      setIsMpChatLaunch(false);
      setDetectionComplete(true);
      setAutoLoginPending(false);
      return;
    }

    if (isLikelyMpChatLaunch()) {
      setIsMpChatLaunch(true);
      setDetectionComplete(true);
      setAutoLoginPending(true);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      // Telegram's SDK loads `afterInteractive`, so a Telegram launch can surface
      // mid-poll. Bail the moment it does, before any MPChat login attempt.
      if (isTelegramMiniAppLaunch()) {
        setIsMpChatLaunch(false);
        setDetectionComplete(true);
        setAutoLoginPending(false);
        window.clearInterval(interval);
        return;
      }

      if (getMpChatWebApp() || readMpChatInitData()) {
        setIsMpChatLaunch(true);
        setDetectionComplete(true);
        setAutoLoginPending(true);
        window.clearInterval(interval);
        return;
      }

      if (Date.now() - startedAt >= MPCHAT_DETECTION_TIMEOUT_MS) {
        setIsMpChatLaunch(false);
        setDetectionComplete(true);
        setAutoLoginPending(false);
        window.clearInterval(interval);
      }
    }, MPCHAT_DETECTION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [setAutoLoginPending]);

  const enabled = isMpChatMiniAppEnabled() && isMpChatLaunch && detectionComplete;

  const subscribe = useCallback((onStoreChange: () => void) => {
    const interval = window.setInterval(onStoreChange, JWT_RESYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const jwtAuth = useSyncJwtBasedAuthState({
    enabled,
    subscribe,
    getExternalJwt: getMpChatExternalJwt,
    onError: (error) => {
      console.warn("mpchat privy jwt auth failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    },
  });

  useEffect(() => {
    if (!isMpChatMiniAppEnabled() || !isMpChatLaunch) {
      setAutoLoginPending(false);
      return;
    }

    if (status === "authenticated") {
      setAutoLoginPending(false);
      return;
    }

    setAutoLoginPending(
      jwtAuth.state.status === "initial" || jwtAuth.state.status === "loading",
    );
  }, [isMpChatLaunch, jwtAuth.state.status, setAutoLoginPending, status]);

  const mpChatSignerNamespaces = useMemo(() => [ChainNamespace.EVM], []);
  usePrivySessionSignerProvisioning({
    enabled: enabled && status === "authenticated",
    storagePrefix: "mpchat-session-signer",
    userId: user?.id,
    wallets,
    chainNamespaces: mpChatSignerNamespaces,
    addSigners,
  });

  return null;
}
