"use client";

/**
 * AppLayout for the prediction standalone app.
 *
 * Provider nesting:
 *
 *   QueryClientProvider
 *   └─ WalletConnector (Privy)
 *       └─ LocaleProvider
 *           └─ PredictProvider
 *               └─ PageShell (Scaffold with header / footer)
 */

import {
  MouseEvent,
  PropsWithChildren,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LocaleCode,
  useTranslation,
  useLocale,
  useChangeLocale,
  useLocaleContext,
} from "@liberfi.io/i18n";
import { useResolvedApiLang } from "src/i18n/ResolvedLocaleProvider";
import {
  PredictClient,
  MarketDataProvider,
  PredictWsClient,
  PredictProvider,
  PolymarketProvider,
  usePredictWsClient,
  usePredictClient,
  useDeployPolymarketDepositWallet,
  polymarketSetupQueryKey,
} from "@liberfi.io/react-predict";
import type { PredictSearchResult } from "@liberfi.io/react-predict";
import { createMarketDataCentrifugoTransportFactory } from "src/libs/marketDataCentrifugoClient";
import {
  SearchEventsButton,
  PredictSearchModal,
  PREDICT_SEARCH_MODAL_ID,
  PredictWalletProvider,
  KycModal,
  SetupModal,
  usePredictWallet,
} from "@liberfi.io/ui-predict";
import {
  useAuth,
  useWallets,
  type EvmWalletAdapter,
} from "@liberfi.io/wallet-connector";
import { truncateAddress } from "@liberfi.io/utils";
import { createWalletClient, custom, type Hex } from "viem";
import { polygon } from "viem/chains";
import {
  StyledToaster,
  ChartLineIcon,
  ZapFastIcon,
  UserIcon,
  LogoIcon,
  cn,
  DollarIcon,
  PolymarketIcon,
  KalshiIcon,
  SolanaIcon,
  PolygonIcon,
  VerifiedIcon,
  TranslateIcon,
  SearchIcon,
  SignInIcon,
  Spinner,
  WalletIcon,
  CoinsIcon,
  useScreen,
} from "@liberfi.io/ui";
import type { LinkComponentType } from "@liberfi.io/ui";
import {
  Scaffold,
  ScaffoldHeader,
  ScaffoldFooter,
  Logo,
  type NavItem,
} from "@liberfi.io/ui-scaffold";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import {
  ENABLE_KALSHI,
  MARKET_DATA_FEATURE_CAPABILITY,
  SPORTS_FEATURE_FLAGS,
  SPORTS_NAVIGATION_ENABLED,
  isSportsNavigationEnabled,
} from "../libs/featureFlags";
import { AuthProviders } from "./AuthProviders";
import { AutoSetupPolymarketDepositWallet } from "./AutoSetupPolymarketDepositWallet";
import { MpChatPrivyAutoLogin } from "./MpChatPrivyAutoLogin";
import { TelegramPrivyAutoLogin } from "./TelegramPrivyAutoLogin";
import { MiniAppCaptchaGate } from "../features/miniapp-captcha/MiniAppCaptchaGate";
import {
  FundWalletModal,
  FUND_WALLET_MODAL_ID,
  type FundWalletParams,
} from "./FundWalletModal";
import { SetupWalletModal } from "./SetupWalletModal";
import { ReceiveOutlinedIcon } from "./icons/ReceiveOutlinedIcon";
import { SendOutlinedIcon } from "./icons/SendOutlinedIcon";
import {
  deploySafe,
  executeSafe,
  executeDepositWalletBatch,
  buildAllApprovalTxns,
  buildAllDepositApprovalCalls,
  pollTransaction,
  type PolymarketRelayConfig,
} from "../lib/polymarket-relay";
import { ReferralCapture } from "../features/referral/components/ReferralCapture";
import { mpChatAutoLoginPendingAtom } from "../features/mpchat-miniapp/state";
import { telegramMiniAppAutoLoginPendingAtom } from "../features/telegram-miniapp/state";
import { polymarketAutoSetupPendingAtom } from "../lib/polymarketAutoSetupState";
import { readTelegramMiniAppContext } from "../features/telegram-miniapp/launchParams";
import { readMpChatMiniAppContext } from "../features/mpchat-miniapp/launchParams";
import { NavigationPendingFallback } from "./NavigationPendingFallback";
import {
  setOptimisticNavigationTarget,
  useOptimisticNavigationTarget,
} from "./navigationTransition";

type PositionValueSource = "kalshi" | "polymarket" | "dflow";
type PositionValueResponse = {
  source?: PositionValueSource;
  value: string;
  currency: string;
  values?: Array<{
    source: PositionValueSource;
    user: string;
    value: string;
    currency: string;
  }>;
};

const NoPrefetchLink: LinkComponentType = (props) => (
  <Link prefetch={false} {...props} />
);

const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
const LEADERBOARD_NAV_HREF = "/leaderboard?scope=worldcup_2026&interval=7d";
const SPORTS_FLAGS = SPORTS_FEATURE_FLAGS;

function navPathname(href: string): string {
  return href.split("?")[0] || "/";
}

function currentNavHref(pathname: string): string {
  if (typeof window === "undefined") return pathname;
  return `${pathname}${window.location.search}`;
}

function sortedSearchEntries(params: URLSearchParams): string[] {
  return Array.from(params.entries())
    .map(([key, value]) => `${key}\u0000${value}`)
    .sort();
}

function sameNavDestination(currentHref: string, targetHref: string): boolean {
  const base =
    typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const current = new URL(currentHref, base);
  const target = new URL(targetHref, base);
  if (current.pathname !== target.pathname) return false;

  const currentEntries = sortedSearchEntries(current.searchParams);
  const targetEntries = sortedSearchEntries(target.searchParams);
  if (currentEntries.length !== targetEntries.length) return false;
  return currentEntries.every((entry, index) => entry === targetEntries[index]);
}

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

const navItemsConfig: Omit<NavItem, "label">[] = [
  {
    key: "sports",
    href: "/sports",
    icon: <ChartLineIcon width={20} height={20} />,
  },
  {
    key: "esports",
    href: "/esports",
    icon: <ZapFastIcon width={20} height={20} />,
  },
  {
    key: "worldcup",
    href: "/world-cup",
    icon: (
      <span className="relative flex h-5 w-5 items-center justify-center">
        <img
          src="/worldcup/trophy.webp"
          alt=""
          aria-hidden
          className="absolute bottom-0 h-11 w-auto max-w-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
        />
      </span>
    ),
  },
  {
    key: "markets",
    href: "/events",
    icon: <ChartLineIcon width={20} height={20} />,
  },
  {
    key: "matches",
    href: "/matches",
    icon: <ZapFastIcon width={20} height={20} />,
  },
  {
    key: "leaderboard",
    href: LEADERBOARD_NAV_HREF,
    match: "/leaderboard",
    icon: (
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    ),
  },
  {
    key: "portfolio",
    href: "/portfolio",
    icon: <UserIcon width={20} height={20} />,
  },
  {
    key: "referral",
    href: "/referral",
    icon: (
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points="20 12 20 22 4 22 4 12" />
        <rect x="2" y="7" width="20" height="5" />
        <line x1="12" y1="22" x2="12" y2="7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <>
      <AuthProviders>
        <MiniAppCaptchaGate>
          <TelegramPrivyAutoLogin />
          <MpChatPrivyAutoLogin />
          <ServiceProviders>
            <PageShell>{children}</PageShell>
            <div className="predict-toast-scope">
              <StyledToaster />
            </div>
            <PredictSearchModal />
          </ServiceProviders>
        </MiniAppCaptchaGate>
      </AuthProviders>
    </>
  );
}

// ---------------------------------------------------------------------------
// Service providers (withPredict)
// ---------------------------------------------------------------------------

function ServiceProviders({ children }: PropsWithChildren) {
  const apiLang = useResolvedApiLang();
  const predictClient = useMemo(
    () =>
      new PredictClient(baseUrl + process.env.NEXT_PUBLIC_PREDICT_URL, {
        headers: () => ({ "Accept-Language": apiLang }),
      }),
    [apiLang],
  );

  // Live WebSocket client for orderbook/price/trade subscriptions. Falls back
  // to `null` when the env var is not configured, in which case the SDK's
  // realtime hooks transparently degrade to REST polling.
  const predictWsClient = useMemo(() => {
    const wsUrl = process.env.NEXT_PUBLIC_PREDICT_WS_URL;
    if (!wsUrl) return null;
    return new PredictWsClient({ wsUrl });
  }, []);
  const marketDataTransportFactory = useMemo(() => {
    const endpoint = process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL;
    if (!MARKET_DATA_FEATURE_CAPABILITY.enabled || !endpoint) {
      return undefined;
    }
    return createMarketDataCentrifugoTransportFactory({ endpoint });
  }, []);

  return (
    <PredictProvider client={predictClient} wsClient={predictWsClient}>
      <MarketDataProvider
        capability={MARKET_DATA_FEATURE_CAPABILITY}
        client={predictClient}
        transportFactory={marketDataTransportFactory}
      >
        <PolymarketProvider>{children}</PolymarketProvider>
      </MarketDataProvider>
    </PredictProvider>
  );
}

// ---------------------------------------------------------------------------
// Page shell (Scaffold with header / footer)
// ---------------------------------------------------------------------------

function PageShell({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const optimisticNav = useOptimisticNavigationTarget();
  const activePathname = optimisticNav?.pathname ?? pathname;
  const showPendingContent = Boolean(
    optimisticNav &&
    pathname === optimisticNav.fromPathname &&
    pathname !== optimisticNav.pathname,
  );

  const navItems: NavItem[] = useMemo(
    () =>
      navItemsConfig
        .filter((item) =>
          isSportsNavigationEnabled(
            item.key,
            SPORTS_FLAGS,
            SPORTS_NAVIGATION_ENABLED,
          ),
        )
        .map((item) => ({
          ...item,
          label: t(`extend.nav.${item.key}`) as string,
        })),
    [t],
  );

  // Mobile footer: hide matches / portfolio / referral and place worldcup
  // in the middle. The full nav list stays intact for everything else.
  const footerNavItems: NavItem[] = useMemo(() => {
    const hidden = new Set(["matches", "portfolio", "referral"]);
    const visible = navItems.filter((item) => !hidden.has(item.key));
    const worldcup = visible.find((item) => item.key === "worldcup");
    if (!worldcup) return visible;
    const rest = visible.filter((item) => item.key !== "worldcup");
    const mid = Math.floor(rest.length / 2);
    return [...rest.slice(0, mid), worldcup, ...rest.slice(mid)];
  }, [navItems]);

  // Warm the nav destinations, but never at the expense of the first paint.
  // On `/` (a redirect splash that immediately navigates away) we skip it
  // entirely — otherwise these 5 RSC prefetches fire while the launch is still
  // resolving and starve the critical path (matches lookup + the real target
  // page) for connections, which is the main cause of the slow Telegram load.
  // Elsewhere we defer to idle so prefetching trails, not blocks, the page.
  useEffect(() => {
    if (pathname === "/") return;

    const prefetchAll = () => {
      navItems.forEach((item) => {
        if (navPathname(item.href) !== pathname) {
          router.prefetch(item.href);
        }
      });
    };

    const ric = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    if (typeof ric === "function") {
      const id = ric(prefetchAll, { timeout: 3000 });
      return () => {
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(id);
      };
    }

    const timer = setTimeout(prefetchAll, 1500);
    return () => clearTimeout(timer);
  }, [navItems, router, pathname]);

  const navigateWithOptimism = useCallback(
    (href: string, options?: { replace?: boolean }) => {
      setOptimisticNavigationTarget({
        href,
        pathname: navPathname(href),
        fromPathname: pathname,
      });
      if (options?.replace) router.replace(href);
      else router.push(href);
    },
    [pathname, router],
  );

  useEffect(() => {
    if (!optimisticNav) return;
    if (
      pathname === optimisticNav.pathname ||
      pathname !== optimisticNav.fromPathname
    ) {
      setOptimisticNavigationTarget(null);
    }
  }, [optimisticNav, pathname]);

  const { onOpen: openPredictSearch, onClose: closePredictSearch } =
    useAsyncModal(PREDICT_SEARCH_MODAL_ID);

  const predictSearchHref = useCallback((target: PredictSearchResult) => {
    return target.detail_url;
  }, []);

  const handlePredictHover = useCallback(
    (result: PredictSearchResult) => {
      router.prefetch(predictSearchHref(result));
    },
    [predictSearchHref, router],
  );

  const searchModalParams = useMemo(
    () => ({
      getEventHref: (result: PredictSearchResult) => predictSearchHref(result),
      LinkComponent: NoPrefetchLink,
      onHover: handlePredictHover,
      // When Kalshi is disabled, restrict search to Polymarket events only.
      source: ENABLE_KALSHI ? undefined : ("polymarket" as const),
    }),
    [handlePredictHover, predictSearchHref],
  );

  const handleSelectEvent = useCallback(
    (result: PredictSearchResult) => {
      router.push(predictSearchHref(result));
      closePredictSearch();
    },
    [predictSearchHref, router, closePredictSearch],
  );

  return (
    <PredictWalletProvider enabled enableKalshi={ENABLE_KALSHI}>
      <PredictWsConnector />
      <AutoSetupPolymarketDepositWallet />
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <Scaffold
        pathname={activePathname}
        onNavigate={navigateWithOptimism}
        headerHeight={48}
        headerVisible={["desktop", "tablet", "mobile"]}
        footerVisible={["mobile"]}
        header={
          <ScaffoldHeader className="!bg-[#0a0a0b] !border-none">
            <div
              className="w-full h-full px-6 max-lg:px-4 max-sm:px-3 flex items-center gap-6 max-lg:gap-4 max-sm:gap-2"
              style={{
                borderBottom: "1px solid rgba(39,39,42,0.6)",
              }}
            >
              {/* Left: Logo + desktop nav tabs */}
              <div className="shrink-0 flex items-center gap-1">
                <Logo icon={<LogoIcon />} />
                <div className="hidden sm:flex items-center gap-1 ml-2">
                  {/* Hide "matches" (跨平台匹配) in the desktop header only;
                        the route/module and mobile footer entry stay intact. */}
                  {navItems
                    .filter((item) => item.key !== "matches")
                    .map((item) => {
                      const itemPathname = navPathname(item.href);
                      const active = activePathname.startsWith(itemPathname);
                      return (
                        <NavTab
                          key={item.key}
                          item={item}
                          active={active}
                          pathname={pathname}
                        />
                      );
                    })}
                </div>
              </div>

              {/* Center: Search bar — desktop only */}
              <div className="hidden lg:flex flex-1 min-w-0 justify-center">
                <SearchEventsButton
                  onSelectEvent={handleSelectEvent}
                  modalParams={searchModalParams}
                  className="w-full !min-w-0 !max-w-md !rounded-lg !bg-zinc-900/60 !border-[1px] !border-zinc-800 hover:!border-zinc-700 !h-[30px] !min-h-0 [&_kbd]:!rounded [&_kbd]:!bg-zinc-800/60 [&_kbd]:!border-zinc-700/50 [&_kbd]:!text-zinc-500 [&_kbd]:!font-mono [&_kbd]:!text-[10px]"
                />
              </div>

              {/* Right: search icon (tablet/mobile) + account control. The
                    language switcher lives inside the account/balance dropdown
                    (LanguageMenuItem), so it is intentionally not duplicated here. */}
              <div className="shrink-0 ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openPredictSearch({ params: searchModalParams })
                  }
                  aria-label="Search"
                  className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-sm font-medium transition-colors border bg-zinc-800/60 text-zinc-300 border-zinc-700/50 hover:bg-zinc-800 hover:text-white cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <SearchIcon width={14} height={14} />
                </button>
                <PredictAccountControl onNavigate={navigateWithOptimism} />
              </div>
            </div>
          </ScaffoldHeader>
        }
        footer={<ScaffoldFooter navItems={footerNavItems} />}
      >
        {showPendingContent && optimisticNav ? (
          <NavigationPendingFallback pathname={optimisticNav.pathname} />
        ) : (
          children
        )}
      </Scaffold>
      <FundWalletModal />
      <SetupWalletModal />
    </PredictWalletProvider>
  );
}

// ---------------------------------------------------------------------------
// NavTab — inline header nav tab (used inside custom ScaffoldHeader children)
// ---------------------------------------------------------------------------

function NavTab({
  item,
  active,
  pathname,
}: {
  item: NavItem;
  active: boolean;
  pathname: string;
}) {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isPlainLeftClick(event)) return;

      if (sameNavDestination(currentNavHref(pathname), item.href)) {
        event.preventDefault();
        return;
      }

      setOptimisticNavigationTarget({
        href: item.href,
        pathname: navPathname(item.href),
        fromPathname: pathname,
      });
    },
    [item.href, pathname],
  );

  return (
    <Link
      href={item.href}
      prefetch={false}
      data-active={active}
      className={cn(
        "px-3 py-1.5 text-sm font-medium rounded-[10px] transition-colors cursor-pointer whitespace-nowrap focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        item.key === "worldcup" && "relative",
        active
          ? "text-[#c7ff2e]"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40",
      )}
      onClick={handleClick}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
    >
      {item.key === "worldcup" && (
        <img
          src="/worldcup/trophy.webp"
          alt=""
          aria-hidden
          className="absolute left-1 top-1/2 h-[18px] w-auto -translate-y-1/2"
        />
      )}
      <span className={item.key === "worldcup" ? "pl-[4px]" : undefined}>
        {item.label}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Balance indicator
// ---------------------------------------------------------------------------

/** Truncate a USD amount to integer cents (floor). */
function toCents(amount: number): number {
  return Math.floor(amount * 100);
}

/** Format a raw USD amount (truncates to 2 dp, no rounding). */
function formatUsdc(amount: number): string {
  return formatCents(toCents(amount));
}

/** Format an integer-cents value as a USD string. */
function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMaybeCents(cents: number, loaded: boolean): string {
  return loaded ? `$${formatCents(cents)}` : "--";
}

function formatMaybeUsdc(amount: number | null, loaded: boolean): string {
  return loaded && amount != null ? `$${formatUsdc(amount)}` : "--";
}

function asDisplayText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asDisplayId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function getMiniAppAccountDisplayName(): string | undefined {
  const telegramUser = readTelegramMiniAppContext()?.user;
  const telegramName =
    asDisplayText(telegramUser?.first_name) ??
    asDisplayText(telegramUser?.username) ??
    asDisplayId(telegramUser?.id);
  if (telegramName) return telegramName;

  const mpChatUser = readMpChatMiniAppContext()?.user;
  return (
    asDisplayText(mpChatUser?.firstName) ??
    asDisplayText(mpChatUser?.first_name) ??
    asDisplayText(mpChatUser?.username) ??
    asDisplayId(mpChatUser?.id)
  );
}

// Small rounded icon chip shared by dropdown rows (balance / positions /
// menu actions), matching the quick-link / sign-out chip style.
function RowIconChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center w-7 h-7 rounded-[10px] bg-zinc-800">
      {children}
    </div>
  );
}

// Read-only info row: chip + label on the left, value on the right. Shares
// the visual rhythm of the summary rows further down the dropdown.
function WalletInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-[10px]">
      <div className="flex items-center gap-2.5">
        <RowIconChip>{icon}</RowIconChip>
        <span className="text-sm text-zinc-300">{label}</span>
      </div>
      <span className="text-sm font-medium text-zinc-100 tabular-nums">
        {value}
      </span>
    </div>
  );
}

// Clickable full-width menu row (deposit / withdraw / verify), styled like
// the quick-link menu items. Supports a disabled state with a trailing
// spinner for the in-progress verification case.
function WalletMenuRow({
  icon,
  label,
  onClick,
  disabled,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick?.();
      }}
      className={cn(
        "flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-[10px] transition-colors text-zinc-300",
        disabled
          ? "opacity-60 cursor-default"
          : "cursor-pointer hover:bg-[rgba(39,39,42,0.5)] hover:text-white",
      )}
    >
      <RowIconChip>{icon}</RowIconChip>
      <span className="flex-1 text-left">{label}</span>
      {trailing}
    </button>
  );
}

// One venue (Kalshi / Polymarket) block: an identity header (venue logo +
// address + neutral chain pill + a pure verification-status pill) followed
// by a status-driven body:
//   verified   → balance, positions, deposit, withdraw rows
//   unverified → a single "verify" action row
//   verifying  → the same verify row, disabled with a trailing spinner
function WalletEntry({
  address,
  displayName,
  venueIcon,
  chainLabel,
  chainIcon,
  kind,
  status,
  balance,
  balanceLoaded,
  positionsCents,
  positionsLoaded,
  onVerify,
  onDeposit,
  onWithdraw,
}: {
  address?: string;
  displayName?: string;
  venueIcon: React.ReactNode;
  chainLabel: string;
  chainIcon: React.ReactNode;
  kind: "kyc" | "setup";
  status: "verified" | "verifying" | "unverified";
  balance: number | null;
  balanceLoaded: boolean;
  positionsCents: number;
  positionsLoaded: boolean;
  onVerify: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const identityLabel =
    displayName ?? (address ? truncateAddress(address) : "—");

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!address) return;
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [address],
  );

  return (
    <div>
      {/* Identity header: venue logo + account label + chain / status pills */}
      <div className="flex items-start gap-3 px-3 py-2">
        <div className="flex items-center justify-center w-10 h-10 flex-shrink-0">
          {venueIcon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-300 truncate">
              {identityLabel}
            </span>
            {address && !displayName && (
              <button
                type="button"
                className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                title="Copy Address"
                onClick={handleCopy}
              >
                {copied ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                )}
              </button>
            )}
          </div>
          {/* Chain pill (neutral) + verification status pill (info only) */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-700/50 text-zinc-300">
              {chainIcon}
              {chainLabel}
            </span>
            {status === "verified" && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-bullish/15 text-bullish">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t(`extend.predict.${kind}.verified`)}
              </span>
            )}
            {status === "verifying" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-500/15 text-zinc-400">
                <span className="inline-block w-2.5 h-2.5 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
                {t(`extend.predict.${kind}.verifying`)}
              </span>
            )}
            {status === "unverified" && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                {t("extend.predict.account.unverified")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status-driven body */}
      {status === "verified" ? (
        <>
          <WalletInfoRow
            icon={<DollarIcon width={14} height={14} />}
            label={t("extend.predict.account.availableBalance")}
            value={formatMaybeUsdc(balance, balanceLoaded)}
          />
          <WalletInfoRow
            icon={
              <ChartLineIcon width={14} height={14} className="text-bullish" />
            }
            label={t("extend.predict.account.positions")}
            value={formatMaybeCents(positionsCents, positionsLoaded)}
          />
          <WalletMenuRow
            icon={<ReceiveOutlinedIcon width={14} height={14} />}
            label={t("extend.predict.fundWallet.deposit")}
            onClick={onDeposit}
          />
          <WalletMenuRow
            icon={<SendOutlinedIcon width={14} height={14} />}
            label={t("extend.predict.fundWallet.withdraw")}
            onClick={onWithdraw}
          />
        </>
      ) : status === "verifying" ? (
        <WalletMenuRow
          icon={<VerifiedIcon width={14} height={14} />}
          label={t(`extend.predict.${kind}.unverifiedShort`)}
          disabled
          trailing={
            <span className="inline-block w-3.5 h-3.5 border-[1.5px] border-current border-t-transparent rounded-full animate-spin text-zinc-500" />
          }
        />
      ) : (
        <WalletMenuRow
          icon={<VerifiedIcon width={14} height={14} />}
          label={t(`extend.predict.${kind}.unverifiedShort`)}
          onClick={onVerify}
        />
      )}
    </div>
  );
}

// Inline language switcher rendered inside the balance dropdown. Tapping the
// row expands a nested list of locales; selecting one switches immediately.
function LanguageMenuItem() {
  const { t } = useTranslation();
  const locale = useLocale();
  const changeLocale = useChangeLocale();
  const { languages } = useLocaleContext();
  const [expanded, setExpanded] = useState(false);

  const current = languages.find((l) => l.localCode === locale);

  return (
    <div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-[10px] transition-colors cursor-pointer text-zinc-300 hover:bg-[rgba(39,39,42,0.5)] hover:text-white"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-[10px] bg-zinc-800">
          <TranslateIcon width={14} height={14} />
        </div>
        <span className="flex-1 text-left">{t("extend.header.language")}</span>
        {current && (
          <span className="text-xs text-zinc-500">{current.displayName}</span>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "text-zinc-500 transition-transform",
            expanded && "rotate-180",
          )}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-1 space-y-0.5">
          {languages.map((lang) => {
            const selected = lang.localCode === locale;
            return (
              <button
                key={lang.localCode}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  changeLocale(lang.localCode as LocaleCode);
                  setExpanded(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between pl-12 pr-3 py-2 rounded-[10px] text-sm transition-colors cursor-pointer",
                  selected
                    ? "bg-[#c7ff2e]/[0.08] text-[#c7ff2e]"
                    : "text-zinc-400 hover:text-white hover:bg-[rgba(39,39,42,0.5)]",
                )}
              >
                {lang.displayName}
                {selected && (
                  <svg
                    viewBox="0 0 24 24"
                    width={16}
                    height={16}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="flex-shrink-0"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface BalanceDropdownProps {
  solanaAddress?: string;
  evmAddress?: string;
  accountDisplayName?: string;
  kalshiUsdcBalance: number | null;
  polymarketUsdcBalance: number | null;
  kalshiBalanceLoaded: boolean;
  polymarketBalanceLoaded: boolean;
  kalshiKycLoading: boolean;
  kalshiKycVerified: boolean;
  polymarketSetupLoading: boolean;
  polymarketSetupVerified: boolean;
  onKycOpen: () => void;
  onSetupOpen: () => void;
  onKalshiDeposit: () => void;
  onKalshiWithdraw: () => void;
  onPolymarketDeposit: () => void;
  onPolymarketWithdraw: () => void;
  onPortfolio: () => void;
  onReferral: () => void;
  onSignOut: () => void;
  kalshiPositionsCents: number;
  polymarketPositionsCents: number;
  cashTotalCents: number;
  positionsCents: number;
  portfolioTotalCents: number;
  cashLoaded: boolean;
  positionsLoaded: boolean;
  portfolioLoaded: boolean;
}

function BalanceDropdownContent({
  solanaAddress,
  evmAddress,
  accountDisplayName,
  kalshiUsdcBalance,
  polymarketUsdcBalance,
  kalshiBalanceLoaded,
  polymarketBalanceLoaded,
  kalshiKycLoading,
  kalshiKycVerified,
  polymarketSetupLoading,
  polymarketSetupVerified,
  onKycOpen,
  onSetupOpen,
  onKalshiDeposit,
  onKalshiWithdraw,
  onPolymarketDeposit,
  onPolymarketWithdraw,
  onPortfolio,
  onReferral,
  onSignOut,
  kalshiPositionsCents,
  polymarketPositionsCents,
  cashTotalCents,
  positionsCents,
  portfolioTotalCents,
  cashLoaded,
  positionsLoaded,
  portfolioLoaded,
}: BalanceDropdownProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Wallet rows — Kalshi (Solana) and Polymarket (Polygon). Address +
          copy + venue setup status + per-venue USDC. */}
      <div className="p-2">
        {ENABLE_KALSHI && solanaAddress && (
          <WalletEntry
            address={solanaAddress}
            displayName={accountDisplayName}
            venueIcon={<KalshiIcon width={40} height={40} />}
            chainLabel="Solana"
            chainIcon={<SolanaIcon width={12} height={12} />}
            kind="kyc"
            status={
              kalshiKycLoading
                ? "verifying"
                : kalshiKycVerified
                  ? "verified"
                  : "unverified"
            }
            balance={kalshiUsdcBalance}
            balanceLoaded={kalshiBalanceLoaded}
            positionsCents={kalshiPositionsCents}
            positionsLoaded={positionsLoaded}
            onVerify={onKycOpen}
            onDeposit={onKalshiDeposit}
            onWithdraw={onKalshiWithdraw}
          />
        )}
        {ENABLE_KALSHI && solanaAddress && evmAddress && (
          <div
            className="-mx-2 my-1"
            style={{ borderTop: "1px solid rgba(39,39,42,1)" }}
          />
        )}
        {evmAddress && (
          <WalletEntry
            address={evmAddress}
            displayName={accountDisplayName}
            venueIcon={<PolymarketIcon width={40} height={40} />}
            chainLabel="Polygon"
            chainIcon={<PolygonIcon width={12} height={12} />}
            kind="setup"
            status={
              polymarketSetupLoading
                ? "verifying"
                : polymarketSetupVerified
                  ? "verified"
                  : "unverified"
            }
            balance={polymarketUsdcBalance}
            balanceLoaded={polymarketBalanceLoaded}
            positionsCents={polymarketPositionsCents}
            positionsLoaded={positionsLoaded}
            onVerify={onSetupOpen}
            onDeposit={onPolymarketDeposit}
            onWithdraw={onPolymarketWithdraw}
          />
        )}
      </div>

      {/* Summary: available balance + positions + portfolio total. One block,
          no internal dividers; icons use the same chip style as the quick
          links / sign-out menu items below. Hidden when Kalshi is disabled
          since the single remaining venue (Polymarket) already shows its own
          balance / positions rows above. */}
      {ENABLE_KALSHI && (
        <div
          style={{ borderTop: "1px solid rgba(39,39,42,1)" }}
          className="p-2"
        >
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-[10px]">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-[10px] bg-zinc-800">
                <DollarIcon width={14} height={14} />
              </div>
              <span className="text-sm text-zinc-300">
                {t("extend.predict.account.totalAvailableBalance")}
              </span>
            </div>
            <span className="text-sm font-medium text-zinc-100 tabular-nums">
              {formatMaybeCents(cashTotalCents, cashLoaded)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-[10px]">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-[10px] bg-zinc-800">
                <ChartLineIcon
                  width={14}
                  height={14}
                  className="text-bullish"
                />
              </div>
              <span className="text-sm text-zinc-300">
                {t("extend.predict.account.totalPositions")}
              </span>
            </div>
            <span className="text-sm font-medium text-zinc-100 tabular-nums">
              {formatMaybeCents(positionsCents, positionsLoaded)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-[10px]">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-[10px] bg-zinc-800">
                <CoinsIcon width={14} height={14} />
              </div>
              <span className="text-sm text-zinc-300 font-medium">
                {t("extend.predict.account.portfolioTotal")}
              </span>
            </div>
            <span className="text-sm font-bold text-[#c7ff2e] tabular-nums">
              {formatMaybeCents(portfolioTotalCents, portfolioLoaded)}
            </span>
          </div>
        </div>
      )}

      {/* Settings — currently just the language switcher. */}
      <div style={{ borderTop: "1px solid rgba(39,39,42,1)" }} className="p-2">
        <LanguageMenuItem />
      </div>

      {/* Quick links (Portfolio / Referral) + sign out, inherited from the
          former account menu and the header nav. */}
      <div style={{ borderTop: "1px solid rgba(39,39,42,1)" }} className="p-2">
        <button
          type="button"
          onClick={onPortfolio}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-[10px] transition-colors cursor-pointer text-zinc-300 hover:bg-[rgba(39,39,42,0.5)] hover:text-white"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-[10px] bg-zinc-800">
            <WalletIcon width={14} height={14} />
          </div>
          {t("extend.nav.portfolio")}
        </button>
        <button
          type="button"
          onClick={onReferral}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-[10px] transition-colors cursor-pointer text-zinc-300 hover:bg-[rgba(39,39,42,0.5)] hover:text-white"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-[10px] bg-zinc-800">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
          </div>
          {t("extend.nav.referral")}
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-[10px] transition-colors cursor-pointer text-red-400 hover:bg-red-500/10"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-[10px] bg-red-500/10">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
          {t("common.signOut")}
        </button>
      </div>
    </>
  );
}

// Header account control: shows a sign-in button when logged out, a spinner
// while (de)authenticating, and the balance trigger + dropdown once signed in.
// Replaces the former separate PredictBalanceIndicator / PredictDepositButton /
// PredictAccountButton trio.
function PredictAccountControl({
  onNavigate,
}: {
  onNavigate?: (href: string) => void;
}) {
  const { t } = useTranslation();
  const { status, signIn, signOut } = useAuth();
  const mpChatAutoLoginPending = useAtomValue(mpChatAutoLoginPendingAtom);
  const telegramAutoLoginPending = useAtomValue(
    telegramMiniAppAutoLoginPendingAtom,
  );
  const polymarketAutoSetupPending = useAtomValue(
    polymarketAutoSetupPendingAtom,
  );
  const accountDisplayName = getMiniAppAccountDisplayName();
  useEffect(() => {
    console.info("[tg-login] account-control gate", {
      authStatus: status,
      mpChatAutoLoginPending,
      telegramAutoLoginPending,
    });
  }, [status, mpChatAutoLoginPending, telegramAutoLoginPending]);
  const {
    kalshiUsdcBalance,
    polymarketUsdcBalance,
    solanaAddress,
    evmAddress,
    kalshiKycVerified,
    kalshiKycUrl,
    kalshiKycLoading,
    polymarketSetupVerified,
    polymarketTokenApproved,
    polymarketSetupLoading,
    polymarketWalletKind,
    polymarketWalletDeployed,
    polymarketDepositWalletAddress,
  } = usePredictWallet();
  const queryClient = useQueryClient();
  const predictClient = usePredictClient();
  const wallets = useWallets();
  const deployDepositWallet = useDeployPolymarketDepositWallet(evmAddress);
  // Only the explicit legacy `safe` kind takes the Gnosis Safe path; any other
  // value (including an unresolved status) defaults to the deposit-wallet model
  // so a brand-new EOA never accidentally deploys a Gnosis Safe.
  const isDepositWallet = polymarketWalletKind !== "safe";
  const router = useRouter();
  const { isMobile } = useScreen();

  const { data: positionValueData, isLoading: positionValueLoading } = useQuery(
    {
      queryKey: [
        "predict",
        "position-value",
        "multi",
        ENABLE_KALSHI ? solanaAddress || "" : "",
        evmAddress || "",
      ],
      queryFn: () =>
        (
          predictClient as PredictClient & {
            getPositionValue: (wallets: {
              kalshi_user?: string;
              polymarket_user?: string;
            }) => Promise<PositionValueResponse>;
          }
        ).getPositionValue({
          kalshi_user: ENABLE_KALSHI ? solanaAddress || undefined : undefined,
          polymarket_user: evmAddress || undefined,
        }),
      enabled: Boolean((ENABLE_KALSHI && solanaAddress) || evmAddress),
      staleTime: 10_000,
      refetchInterval: 30_000,
    },
  );

  const cashKalshiCents = toCents(kalshiUsdcBalance ?? 0);
  const cashPolymarketCents = toCents(polymarketUsdcBalance ?? 0);
  const cashTotalCents = cashKalshiCents + cashPolymarketCents;
  const kalshiBalanceLoaded = !ENABLE_KALSHI || kalshiUsdcBalance != null;
  const polymarketBalanceLoaded = polymarketUsdcBalance != null;
  const cashLoaded = kalshiBalanceLoaded && polymarketBalanceLoaded;

  const { kalshiPositionsCents, polymarketPositionsCents } = useMemo(() => {
    let kalshi = 0;
    let polymarket = 0;
    const values = positionValueData?.values?.length
      ? positionValueData.values
      : positionValueData?.source
        ? [positionValueData]
        : [];
    for (const value of values) {
      const amount = Number(value.value);
      if (!Number.isFinite(amount)) continue;
      const source = String(value.source);
      if (source === "kalshi" || source === "dflow") kalshi += amount;
      else if (source === "polymarket") polymarket += amount;
    }
    return {
      kalshiPositionsCents: toCents(kalshi),
      polymarketPositionsCents: toCents(polymarket),
    };
  }, [positionValueData]);

  const positionsValue = Number(positionValueData?.value ?? 0);
  const positionsCents = Number.isFinite(positionsValue)
    ? toCents(positionsValue)
    : kalshiPositionsCents + polymarketPositionsCents;

  const portfolioTotalCents = cashTotalCents + positionsCents;

  const positionsLoaded = !positionValueLoading && Boolean(positionValueData);
  const portfolioLoaded = cashLoaded && positionsLoaded;
  const polymarketSetupBusy =
    polymarketSetupLoading || polymarketAutoSetupPending;

  const [isOpen, setIsOpen] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  // Mobile drawer lifecycle: stays mounted through its exit animation.
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Open the shared `FundWalletModal` (mounted once in PageShell). The
  // `initialScreen` + `initialWallet` params jump straight to the
  // deposit / withdraw screen for the specific venue.
  const { onOpen: openFundWallet } =
    useAsyncModal<FundWalletParams>(FUND_WALLET_MODAL_ID);

  // Deposit / withdraw just open the fund-wallet modal without touching the
  // popover's open state — same as the verify (KYC / Setup) action. The
  // modal's backdrop appears over a stationary cursor, which fires no
  // mouseleave, so the hover popover / drawer stays put behind it.
  const handleKalshiDeposit = useCallback(() => {
    void openFundWallet({
      params: { initialScreen: "deposit", initialWallet: "solana" },
    });
  }, [openFundWallet]);

  const handleKalshiWithdraw = useCallback(() => {
    void openFundWallet({
      params: { initialScreen: "withdraw", initialWallet: "solana" },
    });
  }, [openFundWallet]);

  const handlePolymarketDeposit = useCallback(() => {
    void openFundWallet({
      params: { initialScreen: "deposit", initialWallet: "evm" },
    });
  }, [openFundWallet]);

  const handlePolymarketWithdraw = useCallback(() => {
    void openFundWallet({
      params: { initialScreen: "withdraw", initialWallet: "evm" },
    });
  }, [openFundWallet]);

  const relayConfig: PolymarketRelayConfig = useMemo(
    () => ({ signProxyUrl: "/predict-api/api/v1/polymarket/sign" }),
    [],
  );

  const handleDeployAndApprove = useCallback(async () => {
    // Hard gate: never deploy before the authoritative Polymarket setup status
    // resolves. The active wallet model (deposit vs. legacy Safe) is decided by
    // `wallet_kind`; acting while it is still loading risks deploying the wrong
    // wallet type for the EOA (e.g. a Gnosis Safe for a brand-new user).
    if (polymarketSetupLoading) {
      throw new Error("Wallet status is still loading, please try again");
    }

    const evmWallet = wallets.find(
      (w) => w.chainNamespace === "EVM" && w.isConnected,
    ) as EvmWalletAdapter | undefined;
    if (!evmWallet || !evmAddress) {
      throw new Error("EVM wallet not connected");
    }

    await evmWallet.switchChain("137" as never);

    const provider = await evmWallet.getEip1193Provider();
    if (!provider) throw new Error("Cannot get EIP-1193 provider");

    const walletClient = createWalletClient({
      account: evmAddress as Hex,
      chain: polygon,
      transport: custom(provider),
    });

    if (isDepositWallet) {
      // Deposit wallet path: gasless server-side WALLET-CREATE (no signature),
      // then a single WALLET batch granting pUSD + CTF approvals.
      let depositWalletAddress = polymarketDepositWalletAddress;
      if (!polymarketWalletDeployed) {
        const deployResult = await deployDepositWallet.mutateAsync(evmAddress);
        depositWalletAddress =
          deployResult.deposit_wallet_address ?? depositWalletAddress;
      }
      if (!depositWalletAddress) {
        throw new Error("deposit wallet address unavailable");
      }

      if (!polymarketTokenApproved) {
        const approvalCalls = buildAllDepositApprovalCalls();
        const approveResult = await executeDepositWalletBatch(
          walletClient,
          depositWalletAddress as Hex,
          approvalCalls,
          relayConfig,
        );
        if (approveResult.transactionID) {
          await pollTransaction(relayConfig, approveResult.transactionID);
        }
      }

      queryClient.invalidateQueries({
        queryKey: polymarketSetupQueryKey(evmAddress),
      });
      return;
    }

    // Legacy Safe path (signatureType=2, USDC.e, V1 exchanges).
    if (!polymarketWalletDeployed) {
      const deployResult = await deploySafe(walletClient, relayConfig);
      if (deployResult.transactionID) {
        await pollTransaction(relayConfig, deployResult.transactionID);
      }
    }

    if (!polymarketTokenApproved) {
      const approvalTxns = buildAllApprovalTxns();
      const approveResult = await executeSafe(
        walletClient,
        approvalTxns,
        relayConfig,
      );
      if (approveResult.transactionID) {
        await pollTransaction(relayConfig, approveResult.transactionID);
      }
    }

    queryClient.invalidateQueries({
      queryKey: polymarketSetupQueryKey(evmAddress),
    });
  }, [
    wallets,
    evmAddress,
    isDepositWallet,
    polymarketSetupLoading,
    polymarketWalletDeployed,
    polymarketDepositWalletAddress,
    polymarketTokenApproved,
    deployDepositWallet,
    relayConfig,
    queryClient,
  ]);

  const handleMouseEnter = useCallback(() => {
    if (isMobile) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setIsOpen(true);
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (isMobile) return;
    closeTimer.current = setTimeout(() => setIsOpen(false), 150);
  }, [isMobile]);

  const handleClick = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleSignOut = useCallback(async () => {
    setIsOpen(false);
    await signOut();
  }, [signOut]);

  const handleNavigate = useCallback(
    (href: string) => {
      setIsOpen(false);
      if (onNavigate) onNavigate(href);
      else router.push(href);
    },
    [onNavigate, router],
  );

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Drive the mobile drawer's mount/exit: opening mounts it immediately;
  // closing plays the slide-out animation before unmounting.
  useEffect(() => {
    if (!isMobile) {
      setDrawerMounted(false);
      setDrawerClosing(false);
      return;
    }
    if (isOpen) {
      setDrawerMounted(true);
      setDrawerClosing(false);
      return;
    }
    if (!drawerMounted) return;
    setDrawerClosing(true);
    const timer = setTimeout(() => {
      setDrawerMounted(false);
      setDrawerClosing(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [isOpen, isMobile, drawerMounted]);

  const dropdownProps: BalanceDropdownProps = {
    solanaAddress,
    evmAddress,
    accountDisplayName,
    kalshiUsdcBalance,
    polymarketUsdcBalance,
    kalshiBalanceLoaded,
    polymarketBalanceLoaded,
    kalshiKycLoading,
    kalshiKycVerified,
    polymarketSetupLoading: polymarketSetupBusy,
    polymarketSetupVerified,
    onKycOpen: () => setIsKycModalOpen(true),
    onSetupOpen: () => setIsSetupModalOpen(true),
    onKalshiDeposit: handleKalshiDeposit,
    onKalshiWithdraw: handleKalshiWithdraw,
    onPolymarketDeposit: handlePolymarketDeposit,
    onPolymarketWithdraw: handlePolymarketWithdraw,
    onPortfolio: () => handleNavigate("/portfolio"),
    onReferral: () => handleNavigate("/referral"),
    onSignOut: handleSignOut,
    kalshiPositionsCents,
    polymarketPositionsCents,
    cashTotalCents,
    positionsCents,
    portfolioTotalCents,
    cashLoaded,
    positionsLoaded,
    portfolioLoaded,
  };

  // Transitioning (signing in / out): show a compact spinner.
  if (
    mpChatAutoLoginPending ||
    telegramAutoLoginPending ||
    status === "authenticating" ||
    status === "deauthenticating"
  ) {
    return (
      <div className="flex items-center justify-center w-8 h-8">
        <Spinner size="sm" color="current" className="text-zinc-500" />
      </div>
    );
  }

  // Logged out: show the sign-in CTA in place of the balance trigger.
  if (status === "unauthenticated") {
    return (
      <button
        type="button"
        onClick={signIn}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c7ff2e]/10 hover:bg-[#c7ff2e]/20 border border-[#c7ff2e]/25 hover:border-[#c7ff2e]/40 text-[#c7ff2e] rounded-[10px] text-xs font-semibold transition-colors duration-200 cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <SignInIcon width={14} height={14} />
        {t("common.signIn")}
      </button>
    );
  }

  return (
    <div
      className="relative"
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* All sizes: full breakdown with cash + positions + chevron */}
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 rounded-[10px] transition-colors cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <div className="flex items-center gap-1.5" title="Cash Balance">
          <DollarIcon width={16} height={16} aria-hidden="true" />
          <span className="text-xs font-medium text-zinc-100 tabular-nums">
            {formatMaybeCents(cashTotalCents, cashLoaded)}
          </span>
        </div>
        <div className="w-px h-4 bg-zinc-700/40" />
        <div className="flex items-center gap-1.5" title="Positions Value">
          <ChartLineIcon
            width={16}
            height={16}
            className="text-bullish"
            aria-hidden="true"
          />
          <span className="text-xs font-medium text-zinc-100 tabular-nums">
            {formatMaybeCents(positionsCents, positionsLoaded)}
          </span>
        </div>
        {!isMobile && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-zinc-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>

      {/* KYC + Setup modals are owned here because the dropdown's status
          badges (rendered inside BalanceDropdownContent) open them. */}
      <KycModal
        isOpen={isKycModalOpen}
        onClose={() => setIsKycModalOpen(false)}
        kycUrl={kalshiKycUrl}
      />
      {evmAddress && (
        <SetupModal
          isOpen={isSetupModalOpen}
          onClose={() => setIsSetupModalOpen(false)}
          evmAddress={evmAddress}
          walletKind={polymarketWalletKind}
          safeDeployed={polymarketWalletDeployed}
          tokenApproved={polymarketTokenApproved}
          onDeployAndApprove={handleDeployAndApprove}
        />
      )}

      {/* Mobile: right-side drawer sliding in from the edge */}
      {isMobile && drawerMounted && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={() => setIsOpen(false)}
        >
          <div
            className={cn(
              "absolute inset-0 bg-black/60",
              drawerClosing ? "animate-backdrop-out" : "animate-backdrop-in",
            )}
          />
          <div
            className={cn(
              "relative h-full w-80 max-w-[85vw] flex flex-col",
              drawerClosing ? "animate-drawer-out" : "animate-drawer-in",
            )}
            style={{
              borderLeft: "1px solid rgba(39,39,42,1)",
              background: "rgba(24,24,27,1)",
              boxShadow: "-25px 0 50px -12px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 flex-shrink-0"
              style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <span className="text-sm font-semibold text-zinc-100">
                {t("extend.header.userSettings")}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-[10px] text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <BalanceDropdownContent {...dropdownProps} />
            </div>
          </div>
        </div>
      )}

      {/* Tablet & Desktop: popover dropdown */}
      {!isMobile && isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 z-50 max-h-[calc(100vh-5rem)] overflow-y-auto overflow-x-hidden overscroll-contain"
          style={{
            borderRadius: 14,
            border: "1px solid rgba(39,39,42,1)",
            background: "rgba(24,24,27,1)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
        >
          <BalanceDropdownContent {...dropdownProps} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WebSocket connector — always active since the whole app is predict
// ---------------------------------------------------------------------------

function PredictWsConnector() {
  const { wsClient } = usePredictWsClient();

  useEffect(() => {
    if (!wsClient) return;
    wsClient.connect();
    return () => {
      wsClient.disconnect();
    };
  }, [wsClient]);

  return null;
}
