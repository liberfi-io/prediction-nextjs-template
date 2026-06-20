"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy, useWallets, useSigners } from "@privy-io/react-auth";
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
const SESSION_RESET_KEY = "recovery:session-reset";

function readInitDataAgeSeconds(): number | null {
  if (typeof window === "undefined") return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
    .Telegram;
  const initData = tg?.WebApp?.initData;
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const authDate = Number(params.get("auth_date"));
  if (!authDate) return null;
  return Math.round(Date.now() / 1000 - authDate);
}

function RecoveryFlow() {
  const { t } = useTranslation();
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const { addSigners } = useSigners();

  const [phase, setPhase] = useState<RecoveryPhase>("connecting");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  // Gate provisioning until we're confident the active session is a clean
  // seamless Telegram Mini App login (not a bled custom-JWT session).
  const [cleanSession, setCleanSession] = useState(false);
  const sessionDecisionRef = useRef(false);
  const provisionStartedRef = useRef(false);

  const signerId = process.env.NEXT_PUBLIC_PRIVY_SESSION_SIGNER_ID;
  const policyIds = parsePolicyIds(
    process.env.NEXT_PUBLIC_PRIVY_SESSION_SIGNER_POLICY_IDS,
  );

  useEffect(() => {
    readyTelegramWebApp();
    expandTelegramWebApp();
  }, []);

  // The Privy session is shared per app id across the whole origin, so a user
  // already signed into the main app via custom JWT bleeds into /recovery as
  // the wrong identity (it does NOT own the legacy embedded wallet). Privy's
  // seamless Mini App login does not override an existing session, and calling
  // useLoginWithTelegram().login() inside a Mini App opens the web login widget
  // (oauth.telegram.org), which cannot complete in the Telegram webview. So if
  // we land here already authenticated, drop that session once and reload: on a
  // clean load Privy seamlessly re-authenticates as the native Telegram user
  // that owns the wallet.
  useEffect(() => {
    if (!ready) return;
    if (sessionDecisionRef.current) return;
    sessionDecisionRef.current = true;

    const alreadyReset =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SESSION_RESET_KEY) === "1";

    if (authenticated && !alreadyReset) {
      window.sessionStorage.setItem(SESSION_RESET_KEY, "1");
      void logout()
        .catch(() => undefined)
        .finally(() => window.location.reload());
      return;
    }

    // Either no bled session, or we've already cleared it once — trust the
    // seamless login that authenticates as the native Telegram user.
    setCleanSession(true);
  }, [ready, authenticated, logout]);

  // Once seamlessly logged into the legacy user, attach the server session
  // signer to the embedded EVM wallet (the Polymarket deposit-wallet owner).
  useEffect(() => {
    if (!cleanSession) return;
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
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(SESSION_RESET_KEY);
        }
        await logout().catch(() => undefined);
        setPhase("done");
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : String(error);
        // Surface the real failure: without this, the cause is invisible from
        // inside the Telegram Mini App. Do NOT swallow it as a false success.
        console.error("[recovery] addSigners failed", error);
        setErrorDetail(message);
        setPhase("error");
      });
  }, [cleanSession, authenticated, wallets, addSigners, logout, signerId, policyIds]);

  const handleRetry = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(SESSION_RESET_KEY);
    }
    sessionDecisionRef.current = false;
    provisionStartedRef.current = false;
    setCleanSession(false);
    setErrorDetail(null);
    setPhase("connecting");
  }, []);

  // Temporary diagnostics: surface live state so a stuck recovery can be
  // inspected from inside the Telegram webview without a console.
  const initDataAge = readInitDataAgeSeconds();
  const embeddedAddress = wallets.find(
    (wallet) => wallet.walletClientType === "privy" && wallet.address,
  )?.address;
  useEffect(() => {
    console.log("[recovery] state", {
      ready,
      authenticated,
      userId: user?.id,
      wallets: wallets.length,
      embeddedAddress,
      cleanSession,
      phase,
      initDataAge,
    });
  }, [
    ready,
    authenticated,
    user?.id,
    wallets.length,
    embeddedAddress,
    cleanSession,
    phase,
    initDataAge,
  ]);

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

        {phase === "error" && errorDetail && (
          <p className="max-w-full break-words font-mono text-[11px] leading-snug text-white/30">
            {errorDetail}
          </p>
        )}

        {phase === "error" && (
          <button
            type="button"
            onClick={handleRetry}
            className="mt-1 rounded-full bg-[#BCFF2E] px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            {t("extend.recovery.retry", { defaultValue: "Try again" })}
          </button>
        )}

        <pre className="mt-4 w-full whitespace-pre-wrap break-words rounded-lg bg-white/5 p-3 text-left font-mono text-[10px] leading-relaxed text-white/40">
          {`ready=${ready} auth=${authenticated}
user=${user?.id ?? "-"}
wallets=${wallets.length} evm=${embeddedAddress ?? "-"}
clean=${cleanSession} phase=${phase}
initDataAge=${initDataAge ?? "-"}s`}
        </pre>
      </div>
    </div>
  );
}

export default function RecoveryPage() {
  return <RecoveryFlow />;
}
