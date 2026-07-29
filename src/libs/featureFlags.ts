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

export interface MarketDataFeatureCapability {
  enabled: boolean;
}

/**
 * Resolves the default-off market-data-v1 compatibility branch.
 */
export function resolveMarketDataFeatureCapability(
  env: Record<string, string | undefined>,
): MarketDataFeatureCapability {
  return {
    enabled:
      env.NEXT_PUBLIC_MARKET_DATA_REALTIME_V1_ENABLED?.toLowerCase() === "true",
  };
}

export const MARKET_DATA_FEATURE_CAPABILITY =
  resolveMarketDataFeatureCapability({
    NEXT_PUBLIC_MARKET_DATA_REALTIME_V1_ENABLED:
      process.env.NEXT_PUBLIC_MARKET_DATA_REALTIME_V1_ENABLED,
  });

export interface SportsFeatureFlags {
  sports_enabled: boolean;
  esports_enabled: boolean;
  sports_match_detail_enabled: boolean;
  sports_match_detail_soccer_enabled: boolean;
  sports_match_detail_baseball_enabled: boolean;
  esports_match_detail_cs2_enabled: boolean;
}

function enabled(value: string | undefined): boolean {
  return value === "true";
}

function enabledUnlessFalse(value: string | undefined): boolean {
  return value !== "false";
}

export function resolveSportsFeatureFlags(
  env: Record<string, string | undefined>,
): SportsFeatureFlags {
  return {
    sports_enabled: enabledUnlessFalse(env.NEXT_PUBLIC_ENABLE_SPORTS),
    esports_enabled: enabledUnlessFalse(env.NEXT_PUBLIC_ENABLE_ESPORTS),
    sports_match_detail_enabled: enabledUnlessFalse(
      env.NEXT_PUBLIC_ENABLE_SPORTS_MATCH_DETAIL,
    ),
    sports_match_detail_soccer_enabled: enabled(
      env.NEXT_PUBLIC_ENABLE_SPORTS_MATCH_DETAIL_SOCCER,
    ),
    sports_match_detail_baseball_enabled: enabled(
      env.NEXT_PUBLIC_ENABLE_SPORTS_MATCH_DETAIL_BASEBALL,
    ),
    esports_match_detail_cs2_enabled: enabled(
      env.NEXT_PUBLIC_ENABLE_ESPORTS_MATCH_DETAIL_CS2,
    ),
  };
}

export function isSportsNavigationEnabled(
  itemKey: string,
  flags: SportsFeatureFlags,
  navigationEnabled = true,
): boolean {
  if (itemKey === "sports") {
    return navigationEnabled && flags.sports_enabled;
  }
  if (itemKey === "esports") {
    return navigationEnabled && flags.esports_enabled;
  }
  return true;
}

/**
 * Resolves whether Sports and Esports appear in the main navigation without
 * changing the availability of their routes.
 */
export function resolveSportsNavigationEnabled(
  env: Record<string, string | undefined>,
): boolean {
  return enabledUnlessFalse(env.NEXT_PUBLIC_ENABLE_SPORTS_NAVIGATION);
}

export const SPORTS_NAVIGATION_ENABLED = resolveSportsNavigationEnabled({
  NEXT_PUBLIC_ENABLE_SPORTS_NAVIGATION:
    process.env.NEXT_PUBLIC_ENABLE_SPORTS_NAVIGATION,
});

export const SPORTS_FEATURE_FLAGS = resolveSportsFeatureFlags({
  NEXT_PUBLIC_ENABLE_SPORTS: process.env.NEXT_PUBLIC_ENABLE_SPORTS,
  NEXT_PUBLIC_ENABLE_ESPORTS: process.env.NEXT_PUBLIC_ENABLE_ESPORTS,
  NEXT_PUBLIC_ENABLE_SPORTS_MATCH_DETAIL:
    process.env.NEXT_PUBLIC_ENABLE_SPORTS_MATCH_DETAIL,
  NEXT_PUBLIC_ENABLE_SPORTS_MATCH_DETAIL_SOCCER:
    process.env.NEXT_PUBLIC_ENABLE_SPORTS_MATCH_DETAIL_SOCCER,
  NEXT_PUBLIC_ENABLE_SPORTS_MATCH_DETAIL_BASEBALL:
    process.env.NEXT_PUBLIC_ENABLE_SPORTS_MATCH_DETAIL_BASEBALL,
  NEXT_PUBLIC_ENABLE_ESPORTS_MATCH_DETAIL_CS2:
    process.env.NEXT_PUBLIC_ENABLE_ESPORTS_MATCH_DETAIL_CS2,
});
