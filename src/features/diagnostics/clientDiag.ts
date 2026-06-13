/**
 * Lightweight client-side load diagnostics.
 *
 * Purpose: trace *where* the initial load spends time — most importantly inside
 * the Telegram Mini App webview, where normal devtools are unavailable. It is a
 * no-op unless explicitly enabled via `?diag=1` (persisted across soft
 * navigations for the session), so it is safe to ship to production.
 *
 * It records named milestones (e.g. when the `/` redirect effect runs) plus a
 * snapshot of Navigation Timing, Resource Timing (which external URL was slow),
 * connection info and the Telegram WebApp context, and silently reports them to
 * the server log (`/api/diag`) via `sendBeacon`. No on-screen UI.
 *
 * It is ON by default so field loads are captured without any opt-in; pass
 * `?diag=0` (or set `localStorage.__diag = "0"`) to disable.
 */

export interface DiagMark {
  name: string;
  /** ms since navigation start (`performance.now`). */
  t: number;
  /** Wall-clock epoch ms. */
  at: number;
}

const FLAG_KEY = "__diag";

const marks: DiagMark[] = [];
let enabledCache: boolean | null = null;
let sessionId: string | null = null;

function round(n: number): number {
  return Math.round(n);
}

/**
 * A random id for this page load, generated once and stable across soft
 * navigations (the module lives for the document's lifetime). All beacons from
 * the same load share it, so concurrent users' reports can be told apart and a
 * single load's milestones can be stitched into one timeline.
 */
function getSessionId(): string {
  if (sessionId) return sessionId;
  try {
    sessionId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  } catch {
    sessionId = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
  return sessionId;
}

/**
 * Whether diagnostics are active. ON by default; turned off only by an explicit
 * `diag=0` in the query/hash or a persisted `localStorage.__diag = "0"` flag.
 */
export function diagEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (enabledCache !== null) return enabledCache;
  let on = true;
  try {
    const { search, hash } = window.location;
    const q = `${search}${hash}`;
    const offInUrl = /(?:[?&#])diag=0(?:&|$)/.test(q);
    const offInStore = window.localStorage.getItem(FLAG_KEY) === "0";
    on = !(offInUrl || offInStore);
  } catch {
    on = true;
  }
  enabledCache = on;
  return on;
}

/** Record a named milestone relative to navigation start. */
export function diagMark(name: string): void {
  if (!diagEnabled()) return;
  try {
    marks.push({ name, t: round(performance.now()), at: Date.now() });
  } catch {
    // diagnostics must never throw
  }
}

export function getDiagMarks(): DiagMark[] {
  return marks.slice();
}

export interface DiagResource {
  name: string;
  type: string;
  start: number;
  duration: number;
  transferKb?: number;
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path =
      u.pathname.length > 64 ? `${u.pathname.slice(0, 64)}…` : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return url.slice(0, 88);
  }
}

/** Resource timings sorted slowest-first (which URL stalled the load). */
export function collectResources(topN = 25): DiagResource[] {
  try {
    const entries = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];
    return entries
      .map((e) => ({
        name: shortenUrl(e.name),
        type: e.initiatorType,
        start: round(e.startTime),
        duration: round(e.duration),
        transferKb: e.transferSize
          ? Math.round(e.transferSize / 1024)
          : undefined,
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, topN);
  } catch {
    return [];
  }
}

export interface DiagNavTiming {
  ttfb: number;
  responseEnd: number;
  domInteractive: number;
  domContentLoaded: number;
  loadEvent: number;
  total: number;
  type: string;
}

export function navTiming(): DiagNavTiming | null {
  try {
    const [nav] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    if (!nav) return null;
    return {
      ttfb: round(nav.responseStart),
      responseEnd: round(nav.responseEnd),
      domInteractive: round(nav.domInteractive),
      domContentLoaded: round(nav.domContentLoadedEventEnd),
      loadEvent: round(nav.loadEventEnd),
      total: round(nav.duration),
      type: nav.type,
    };
  } catch {
    return null;
  }
}

interface DiagConnection {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
}

function connectionInfo(): DiagConnection | null {
  try {
    const c = (
      navigator as Navigator & {
        connection?: DiagConnection;
      }
    ).connection;
    if (!c) return null;
    return {
      effectiveType: c.effectiveType,
      rtt: c.rtt,
      downlink: c.downlink,
      saveData: c.saveData,
    };
  } catch {
    return null;
  }
}

interface DiagTelegram {
  hasWebApp: boolean;
  platform?: string;
  version?: string;
  isExpanded?: boolean;
  userId?: number | string;
}

function telegramInfo(): DiagTelegram {
  try {
    const wa = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            platform?: string;
            version?: string;
            isExpanded?: boolean;
            initDataUnsafe?: { user?: { id?: number | string } };
          };
        };
      }
    ).Telegram?.WebApp;
    return {
      hasWebApp: Boolean(wa),
      platform: wa?.platform,
      version: wa?.version,
      isExpanded: wa?.isExpanded,
      userId: wa?.initDataUnsafe?.user?.id,
    };
  } catch {
    return { hasWebApp: false };
  }
}

export function diagSnapshot(stage: string) {
  return {
    sid: getSessionId(),
    stage,
    url:
      typeof location !== "undefined"
        ? location.pathname + location.search
        : "",
    ts: new Date().toISOString(),
    ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
    marks: getDiagMarks(),
    nav: navTiming(),
    connection: connectionInfo(),
    telegram: telegramInfo(),
    resources: collectResources(),
  };
}

/** Fire-and-forget report of the current snapshot to the server log. */
export function diagReport(stage: string): void {
  if (!diagEnabled()) return;
  try {
    const body = JSON.stringify(diagSnapshot(stage));
    const sent =
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon("/api/diag", body);
    if (!sent) {
      void fetch("/api/diag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // diagnostics must never throw
  }
}
