import { randomUUID } from "crypto";

export interface VerifyTurnstileTokenInput {
  token: string;
  remoteIp?: string;
  expectedAction?: string;
}

export interface VerifyTurnstileTokenResult {
  success: boolean;
  error?: "turnstile_unconfigured" | "turnstile_failed" | "turnstile_timeout";
  errorCodes?: string[];
}

interface TurnstileSiteverifyResponse {
  success?: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  "error-codes"?: string[];
}

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_VERIFY_TIMEOUT_MS = 5000;

export async function verifyTurnstileToken({
  token,
  remoteIp,
  expectedAction,
}: VerifyTurnstileTokenInput): Promise<VerifyTurnstileTokenResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { success: false, error: "turnstile_unconfigured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TURNSTILE_VERIFY_TIMEOUT_MS);

  try {
    const form = new URLSearchParams({
      secret,
      response: token,
      idempotency_key: randomUUID(),
    });
    if (remoteIp) form.set("remoteip", remoteIp);

    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    const result = (await response.json().catch(() => ({}))) as
      TurnstileSiteverifyResponse;

    if (!response.ok || result.success !== true) {
      return {
        success: false,
        error: "turnstile_failed",
        errorCodes: result["error-codes"],
      };
    }

    if (!isAllowedHostname(result.hostname)) {
      console.warn("turnstile hostname rejected", { hostname: result.hostname });
      return { success: false, error: "turnstile_failed" };
    }

    if (expectedAction && result.action && result.action !== expectedAction) {
      console.warn("turnstile action rejected", { action: result.action });
      return { success: false, error: "turnstile_failed" };
    }

    return { success: true };
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, error: "turnstile_timeout" };
    }
    console.warn("turnstile siteverify failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "turnstile_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

export function readRequestIp(headers: Headers): string | undefined {
  const forwardedFor = headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();
  return (
    firstForwardedIp ||
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    undefined
  );
}

function isAllowedHostname(hostname: string | undefined): boolean {
  const allowedHostnames = parseAllowedHostnames();
  if (!allowedHostnames.length) return true;
  return Boolean(hostname && allowedHostnames.includes(hostname));
}

function parseAllowedHostnames(): string[] {
  return (process.env.MINIAPP_CAPTCHA_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
