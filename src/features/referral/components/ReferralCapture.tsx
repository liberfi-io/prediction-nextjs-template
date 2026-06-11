"use client";

/**
 * Global, render-nothing component mounted inside AppLayout's providers.
 *
 * Responsibilities:
 *  1. On every client navigation, capture `?invite=CODE` (or `?code=CODE`) from
 *     the URL into localStorage (first-touch wins, 30-day TTL).
 *  2. Once the user authenticates and an EVM address is available, bind the
 *     stored invite code via POST /referral/bind, then clear it.
 *
 * It must live below the Privy + PredictWallet providers so `useAuth` and
 * `usePredictWallet` resolve.
 */

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@liberfi.io/wallet-connector";
import { usePredictWallet } from "@liberfi.io/ui-predict";
import { useBindReferral } from "../hooks";
import {
  clearStoredInviteCode,
  getStoredInviteCode,
  readInviteFromSearch,
  storeInviteCode,
} from "../storage";

export function ReferralCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status } = useAuth();
  const { evmAddress } = usePredictWallet();
  const bind = useBindReferral();

  // Track the last code we attempted to bind so we don't loop on it.
  const attemptedRef = useRef<string | null>(null);

  // 1) Capture invite code from the URL on each navigation.
  useEffect(() => {
    const search =
      searchParams?.toString() ||
      (typeof window !== "undefined" ? window.location.search : "");
    const code = readInviteFromSearch(search.startsWith("?") ? search : `?${search}`);
    if (code) {
      storeInviteCode(code);
    }
  }, [pathname, searchParams]);

  // 2) After auth, bind the stored code (once).
  useEffect(() => {
    if (status !== "authenticated" || !evmAddress) return;
    if (bind.isPending) return;

    const code = getStoredInviteCode();
    if (!code) return;
    if (attemptedRef.current === code) return;
    attemptedRef.current = code;

    bind
      .mutateAsync({ invite_code: code, user_address: evmAddress })
      .then((res) => {
        // Bound now, or already had an inviter — either way stop tracking it.
        if (res.bound || res.has_bound_inviter) {
          clearStoredInviteCode();
        }
      })
      .catch(() => {
        // Self-bind / cycle / invalid code: clear so we don't retry endlessly.
        clearStoredInviteCode();
      });
  }, [status, evmAddress, bind]);

  return null;
}
