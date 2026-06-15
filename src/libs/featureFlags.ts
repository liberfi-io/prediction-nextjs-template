/**
 * Client-readable feature flags derived from `NEXT_PUBLIC_*` env vars.
 *
 * Next.js inlines `NEXT_PUBLIC_*` references at build time, so these must be
 * read against literal `process.env.NEXT_PUBLIC_X` expressions.
 */

/**
 * Whether the Kalshi venue is enabled. Defaults to disabled: only an explicit
 * `NEXT_PUBLIC_ENABLE_KALSHI=true` turns it on. When disabled, the Kalshi
 * wallet section and the aggregate balance summary are hidden from the header,
 * and the markets list is pinned to Polymarket only (platform filter hidden).
 */
export const ENABLE_KALSHI = process.env.NEXT_PUBLIC_ENABLE_KALSHI === "true";

/**
 * Whether World Cup Match Center embeds are enabled. Defaults to disabled until
 * the required third-party service package is purchased.
 */
export const ENABLE_WORLD_CUP_MATCH_CENTER = false;
