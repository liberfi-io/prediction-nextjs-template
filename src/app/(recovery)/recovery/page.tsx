"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy, useLoginWithTelegram, useWallets, useSigners } from "@privy-io/react-auth";
import { useTranslation } from "@liberfi.io/i18n";
import { Spinner, VerifiedIcon } from "@liberfi.io/ui";
import {
  expandTelegramWebApp,
  readyTelegramWebApp,
} from "src/features/telegram-miniapp/launchParams";

type RecoveryPhase = "connecting" | "recovering" | "done" | "error";

function parsePolicyIds(value: string | undefined): string[] | undefined {
  const policyIds = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return policyIds?.length ? policyIds : undefined;
}

function isAlreadyAttached(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already|exists|duplicate/i.test(message);
}

/**
 * Wallet recovery page.
 *
 * Legacy Telegram users (whose embedded wallet predates the custom-JWT
 * migration) land here via the `recovery_tg` deep link. We re-authenticate them
 * against their ORIGINAL native-Telegram Privy user (seamless Mini App login),
 * then attach the server session signer to that wallet so the backend can sign
 * on its behalf afterwards (one-off ops withdrawals happen separately).
 *
 * The page never surfaces low-level details (keys, signing, deprecated
 * wallets); it shows a short, reassuring progress state only.
 */
function RecoveryFlow() {
  const { t } = useTranslation();
  const { ready, authenticated, logout } = usePrivy();
  const { login } = useLoginWithTelegram();
  const { wallets } = useWallets();
  const { addSigners } = useSigners();

  const [phase, setPhase] = useState<RecoveryPhase>("connecting");
  const loginStartedRef = useRef(false);
  const provisionStartedRef = useRef(false);

  const signerId = process.env.NEXT_PUBLIC_PRIVY_SESSION_SIGNER_ID;
  const policyIds = parsePolicyIds(
    process.env.NEXT_PUBLIC_PRIVY_SESSION_SIGNER_POLICY_IDS,
  );

  useEffect(() => {
    readyTelegramWebApp();
    expandTelegramWebApp();
  }, []);

  // Trigger native Telegram login once Privy is ready. Seamless Mini App login
  // may already authenticate the user; if not, call `login()` explicitly.
  useEffect(() => {
    if (!ready || authenticated) return;
    if (loginStartedRef.current) return;
    loginStartedRef.current = true;
    void login().catch(() => {
      setPhase("error");
    });
  }, [ready, authenticated, login]);

  // Once logged into the legacy user, attach the server session signer to the
  // embedded EVM wallet (the Polymarket deposit-wallet owner).
  useEffect(() => {
    if (!authenticated) return;
    if (provisionStartedRef.current) return;

    if (!signerId) {
      setPhase("error");
      return;
    }

    const embedded = wallets.find(
      (wallet) => wallet.walletClientType === "privy" && wallet.address,
    );
    if (!embedded?.address) return;

    provisionStartedRef.current = true;
    setPhase("recovering");

    void addSigners({
      address: embedded.address,
      signers: [{ signerId, policyIds }],
    })
      .then(async () => {
        await logout().catch(() => undefined);
        setPhase("done");
      })
      .catch(async (error: unknown) => {
        if (isAlreadyAttached(error)) {
          await logout().catch(() => undefined);
          setPhase("done");
          return;
        }
        setPhase("error");
      });
  }, [authenticated, wallets, addSigners, logout, signerId, policyIds]);

  const handleRetry = useCallback(() => {
    loginStartedRef.current = false;
    provisionStartedRef.current = false;
    setPhase("connecting");
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0b] px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        {phase === "done" ? (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#BCFF2E]/15 text-[#BCFF2E]">
            <VerifiedIcon className="h-8 w-8" />
          </span>
        ) : phase === "error" ? (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-2xl text-white/80">
            !
          </span>
        ) : (
          <Spinner size="md" />
        )}

        <div className="flex flex-col gap-1.5">
          <p className="text-base font-semibold text-white">
            {phase === "connecting" &&
              t("extend.recovery.connecting", {
                defaultValue: "Connecting your account…",
              })}
            {phase === "recovering" &&
              t("extend.recovery.recovering", {
                defaultValue: "Restoring your wallet access…",
              })}
            {phase === "done" &&
              t("extend.recovery.done", {
                defaultValue: "Recovery complete",
              })}
            {phase === "error" &&
              t("extend.recovery.error", {
                defaultValue: "We couldn't finish just now",
              })}
          </p>
          <p className="text-sm text-white/55">
            {phase === "done"
              ? t("extend.recovery.doneHint", {
                  defaultValue:
                    "Your funds are safe. No further action is needed.",
                })
              : phase === "error"
                ? t("extend.recovery.errorHint", {
                    defaultValue: "Please try again in a moment.",
                  })
                : t("extend.recovery.waitHint", {
                    defaultValue: "This only takes a few seconds.",
                  })}
          </p>
        </div>

        {phase === "error" && (
          <button
            type="button"
            onClick={handleRetry}
            className="mt-1 rounded-full bg-[#BCFF2E] px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            {t("extend.recovery.retry", { defaultValue: "Try again" })}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RecoveryPage() {
  return <RecoveryFlow />;
}
