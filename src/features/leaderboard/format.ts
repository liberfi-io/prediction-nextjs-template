/**
 * Display formatters for leaderboard money / ratio / price / time values.
 *
 * Upstream returns these as high-precision decimal strings; the data adapter
 * parses them to numbers. These helpers are display-only (the values are never
 * used for on-chain math here), so native number formatting is sufficient and
 * no `decimal.js` dependency is introduced. Semantics mirror the SDK guide §6:
 * ratios are fractions (0.1146 → 11.46%), prices are probabilities shown in
 * cents (0.0535 → 5.4¢).
 */

/** Parse a possibly-stringy numeric value, defaulting to 0 on NaN/empty. */
export function num(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Compact magnitude (1.2K / 3.4M / 1.1B) for large USD figures. */
function compact(abs: number, digits: number): string {
  if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(digits)}M`;
  if (abs >= 10_000) return `${(abs / 1_000).toFixed(digits)}K`;
  return abs.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** `$1,234.56` — plain USD, no sign. Large values are compacted. */
export function formatUsd(value: number, digits = 2): string {
  const abs = Math.abs(value);
  const body = compact(abs, abs >= 10_000 ? 1 : digits);
  return value < 0 ? `-$${body}` : `$${body}`;
}

/** `+$1.2K` / `-$340.00` — signed USD, for PNL with directional colour. */
export function formatSignedUsd(value: number, digits = 2): string {
  const abs = Math.abs(value);
  const body = compact(abs, abs >= 10_000 ? 1 : digits);
  if (value > 0) return `+$${body}`;
  if (value < 0) return `-$${body}`;
  return `$${body}`;
}

/** `+11.46%` — a fraction rendered as a signed percentage. */
export function formatPercent(fraction: number, digits = 2): string {
  const pct = fraction * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

/** `73.2%` — a fraction rendered as an unsigned percentage (e.g. win rate). */
export function formatRate(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** `5.4¢` — a probability (0–1) shown in cents. */
export function formatPrice(probability: number): string {
  return `${(probability * 100).toFixed(1)}¢`;
}

/** `1.2h` / `3d 4h` / `12m` — a holding duration in seconds. */
export function formatHoldingTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total === 0) return "—";
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** `10m` / `2h` / `3d` / `5w` — compact "time since" from an ISO/epoch timestamp. */
export function formatRelativeTime(ts: string | number | null | undefined): string {
  if (ts == null || ts === "") return "—";
  const ms = typeof ts === "number" ? ts : Date.parse(String(ts));
  if (!Number.isFinite(ms)) return "—";
  const diff = Math.max(0, Date.now() - ms);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}

/** `0x1234…cdef` — short EVM address. */
export function shortAddress(address: string, head = 6, tail = 4): string {
  if (!address) return "";
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** Tailwind text colour class for a directional PNL value. */
export function pnlColorClass(value: number): string {
  if (value > 0) return "text-bullish";
  if (value < 0) return "text-bearish";
  return "text-zinc-400";
}

/**
 * Trade volume for the active leaderboard window. The board entry only carries
 * today / 7d / 30d / total volume; 30d falls back to total when the upstream
 * has not populated it yet.
 */
export function intervalVolume(
  entry: {
    todayVolume: number;
    sevenDayVolume: number;
    thirtyDayVolume: number;
    totalVolume: number;
  },
  interval: "1d" | "7d" | "30d" | "all",
): number {
  switch (interval) {
    case "1d":
      return entry.todayVolume;
    case "7d":
      return entry.sevenDayVolume;
    case "30d":
      return entry.thirtyDayVolume || entry.totalVolume;
    default:
      return entry.totalVolume;
  }
}
