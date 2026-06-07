/**
 * Client-side invite-code capture storage. The referral landing link can arrive
 * on any route (`?invite=CODE` or `/referral?code=CODE`), so we persist the
 * first-seen code to localStorage and bind it after the user authenticates.
 *
 * First-touch wins: an existing un-expired value is never overwritten.
 */

const STORAGE_KEY = "liberfi_invite_code";
/** Captured invite codes expire after 30 days. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredInvite {
  code: string;
  ts: number;
}

/** Read the query-string invite code from a URL search string. */
export function readInviteFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search);
    const code = params.get("invite") || params.get("code");
    const trimmed = code?.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

/** Persist an invite code (first-touch wins; ignores empty). */
export function storeInviteCode(code: string): void {
  if (typeof window === "undefined") return;
  const trimmed = code.trim();
  if (!trimmed) return;
  const existing = getStoredInviteCode();
  if (existing) return; // first-touch wins
  try {
    const payload: StoredInvite = { code: trimmed, ts: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage unavailable (private mode / quota) — silently ignore.
  }
}

/** Read a non-expired stored invite code, or null. Clears expired entries. */
export function getStoredInviteCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredInvite;
    if (!parsed?.code || typeof parsed.ts !== "number") {
      clearStoredInviteCode();
      return null;
    }
    if (Date.now() - parsed.ts > TTL_MS) {
      clearStoredInviteCode();
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

/** Remove the stored invite code (called after a successful bind). */
export function clearStoredInviteCode(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
