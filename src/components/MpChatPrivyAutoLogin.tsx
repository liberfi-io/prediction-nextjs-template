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
import { mpChatAutoLoginPendingAtom } from "src/features/mpchat-miniapp/state";

const MPCHAT_DETECTION_TIMEOUT_MS = 5000;
const MPCHAT_DETECTION_INTERVAL_MS = 100;
const JWT_RESYNC_INTERVAL_MS = 60 * 1000;

function parsePolicyIds(value: string | undefined): string[] | undefined {
  const policyIds = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return policyIds?.length ? policyIds : undefined;
}

function getSignerProvisioningKey(userId: string, address: string, signerId: string) {
  return `mpchat-session-signer:${userId}:${address}:${signerId}`;
}

export function MpChatPrivyAutoLogin() {
  const { status, user } = useAuth();
  const wallets = useWallets();
  const { addSigners } = useSigners();
  const [, setAutoLoginPending] = useAtom(mpChatAutoLoginPendingAtom);
  const [isMpChatLaunch, setIsMpChatLaunch] = useState(() => isLikelyMpChatLaunch());
  const [detectionComplete, setDetectionComplete] = useState(() => !isMpChatMiniAppEnabled());

  useEffect(() => {
    if (!isMpChatMiniAppEnabled()) {
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

  const signerId = process.env.NEXT_PUBLIC_PRIVY_SESSION_SIGNER_ID;
  const policyIds = useMemo(
    () => parsePolicyIds(process.env.NEXT_PUBLIC_PRIVY_SESSION_SIGNER_POLICY_IDS),
    [],
  );

  useEffect(() => {
    if (!enabled || status !== "authenticated" || !user?.id || !signerId) return;

    const evmWallet = wallets.find(
      (wallet) => wallet.chainNamespace === ChainNamespace.EVM && wallet.isConnected,
    );
    if (!evmWallet?.address) return;

    const key = getSignerProvisioningKey(user.id, evmWallet.address, signerId);
    if (localStorage.getItem(key) === "done") return;

    let cancelled = false;
    void addSigners({
      address: evmWallet.address,
      signers: [{ signerId, policyIds }],
    })
      .then(() => {
        if (!cancelled) localStorage.setItem(key, "done");
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (/already|exists|duplicate/i.test(message)) {
          localStorage.setItem(key, "done");
          return;
        }
        console.warn("mpchat session signer provisioning failed", { message });
      });

    return () => {
      cancelled = true;
    };
  }, [addSigners, enabled, policyIds, signerId, status, user?.id, wallets]);

  return null;
}
