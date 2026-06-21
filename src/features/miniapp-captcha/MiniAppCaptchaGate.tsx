"use client";

import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import {
  Turnstile,
  type TurnstileInstance,
} from "@marsidev/react-turnstile";
import { Button } from "@heroui/react";
import { useTranslation } from "@liberfi.io/i18n";
import { Spinner } from "@liberfi.io/ui";
import {
  detectMiniAppCaptchaPlatform,
  MINIAPP_CAPTCHA_DETECTION_INTERVAL_MS,
  MINIAPP_CAPTCHA_DETECTION_TIMEOUT_MS,
  type MiniAppCaptchaPlatform,
} from "./environment";

type GateStatus =
  | "checking"
  | "not-required"
  | "verified"
  | "challenge"
  | "verifying"
  | "error"
  | "unavailable";

interface CaptchaStatusResponse {
  verified?: boolean;
  platform?: MiniAppCaptchaPlatform;
}

interface CaptchaVerifyResponse {
  success?: boolean;
  error?: string;
}

const TURNSTILE_ACTION = "miniapp-entry";

export function MiniAppCaptchaGate({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const turnstileRef = useRef<TurnstileInstance>();
  const [platform, setPlatform] = useState<MiniAppCaptchaPlatform | null>(null);
  const [status, setStatus] = useState<GateStatus>("checking");

  useEffect(() => {
    if (!siteKey) {
      console.warn("[miniapp-captcha] Turnstile sitekey is not configured");
      setStatus("not-required");
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    const resolvePlatform = (
      nextPlatform: MiniAppCaptchaPlatform,
      intervalId?: number,
    ) => {
      if (cancelled) return;
      if (intervalId) window.clearInterval(intervalId);
      setPlatform(nextPlatform);
      void checkCaptchaStatus(nextPlatform, () => cancelled).then((nextStatus) => {
        if (!cancelled) setStatus(nextStatus);
      });
    };

    const immediatePlatform = detectMiniAppCaptchaPlatform();
    if (immediatePlatform) {
      resolvePlatform(immediatePlatform);
      return () => {
        cancelled = true;
      };
    }

    const interval = window.setInterval(() => {
      const nextPlatform = detectMiniAppCaptchaPlatform();
      if (nextPlatform) {
        resolvePlatform(nextPlatform, interval);
        return;
      }

      if (Date.now() - startedAt >= MINIAPP_CAPTCHA_DETECTION_TIMEOUT_MS) {
        window.clearInterval(interval);
        if (!cancelled) setStatus("not-required");
      }
    }, MINIAPP_CAPTCHA_DETECTION_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [siteKey]);

  const resetChallenge = useCallback(() => {
    turnstileRef.current?.reset();
    setStatus("challenge");
  }, []);

  const handleSuccess = useCallback(
    async (token: string) => {
      if (!platform || status === "verifying") return;

      setStatus("verifying");
      try {
        const response = await fetch("/api/security/miniapp-captcha/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, platform }),
        });
        const body = (await response.json().catch(() => ({}))) as
          CaptchaVerifyResponse;

        if (response.ok && body.success) {
          setStatus("verified");
          return;
        }

        turnstileRef.current?.reset();
        setStatus(
          response.status === 503 || body.error === "turnstile_unconfigured"
            ? "unavailable"
            : "error",
        );
      } catch (error) {
        console.warn("[miniapp-captcha] verification request failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        turnstileRef.current?.reset();
        setStatus("error");
      }
    },
    [platform, status],
  );

  const handleWidgetFailure = useCallback(() => {
    setStatus("error");
  }, []);

  const shouldBlock =
    Boolean(platform) &&
    (status === "checking" ||
      status === "challenge" ||
      status === "verifying" ||
      status === "error" ||
      status === "unavailable");

  return (
    <>
      {children}
      {shouldBlock && siteKey ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-2xl border border-white/10 bg-zinc-950 p-5 text-center shadow-2xl">
            <div className="mb-2 text-lg font-semibold text-white">
              {t("extend.miniAppCaptcha.title")}
            </div>
            <div className="mb-5 text-sm leading-5 text-zinc-400">
              {status === "unavailable"
                ? t("extend.miniAppCaptcha.unavailable")
                : t("extend.miniAppCaptcha.description")}
            </div>

            {status === "checking" ? (
              <div className="flex min-h-[72px] items-center justify-center">
                <Spinner size="md" />
              </div>
            ) : null}

            {status !== "checking" && status !== "unavailable" ? (
              <div className="flex min-h-[72px] justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={siteKey}
                  options={{
                    action: TURNSTILE_ACTION,
                    appearance: "always",
                    refreshExpired: "auto",
                    refreshTimeout: "auto",
                    retry: "auto",
                    size: "normal",
                    theme: "auto",
                  }}
                  onSuccess={handleSuccess}
                  onExpire={resetChallenge}
                  onError={handleWidgetFailure}
                  onTimeout={handleWidgetFailure}
                  onUnsupported={handleWidgetFailure}
                />
              </div>
            ) : null}

            {status === "verifying" ? (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-300">
                <Spinner size="sm" />
                <span>{t("extend.miniAppCaptcha.verifying")}</span>
              </div>
            ) : null}

            {status === "error" ? (
              <div className="mt-4 text-sm text-red-300">
                {t("extend.miniAppCaptcha.failed")}
              </div>
            ) : null}

            {status === "error" || status === "unavailable" ? (
              <Button
                className="mt-4 w-full"
                color="primary"
                size="sm"
                onPress={resetChallenge}
              >
                {t("extend.miniAppCaptcha.retry")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

async function checkCaptchaStatus(
  platform: MiniAppCaptchaPlatform,
  isCancelled: () => boolean,
): Promise<GateStatus> {
  try {
    const response = await fetch("/api/security/miniapp-captcha/status", {
      method: "GET",
      cache: "no-store",
    });
    if (isCancelled()) return "checking";

    const body = (await response.json().catch(() => ({}))) as
      CaptchaStatusResponse;
    return body.verified && (!body.platform || body.platform === platform)
      ? "verified"
      : "challenge";
  } catch (error) {
    console.warn("[miniapp-captcha] status request failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return "challenge";
  }
}
