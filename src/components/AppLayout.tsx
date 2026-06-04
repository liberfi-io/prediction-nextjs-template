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
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  LocaleCode,
  LocaleProvider,
  useTranslation,
  i18n,
  defaultNS,
} from "@liberfi.io/i18n";
import {
  PredictClient,
  PredictWsClient,
  PredictProvider,
  PolymarketProvider,
  usePredictWsClient,
  usePositionsMulti,
} from "@liberfi.io/react-predict";
import type { PredictEvent } from "@liberfi.io/react-predict";
import {
  SearchEventsButton,
  PredictSearchModal,
  PREDICT_SEARCH_MODAL_ID,
  PredictWalletProvider,
} from "@liberfi.io/ui-predict";
import { useAuth } from "@liberfi.io/wallet-connector";
import {
  StyledToaster,
  ChartLineIcon,
  ZapFastIcon,
  UserIcon,
  LogoIcon,
  MiniLogoIcon,
  cn,
  UsdcIcon,
  PolymarketIcon,
  KalshiIcon,
  SearchIcon,
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
import { usePredictWallet } from "@liberfi.io/ui-predict";
import { predictEventHref } from "./page/predict-source";
import { getQueryClient } from "../libs/queryClient";
import { AuthProviders } from "./AuthProviders";
import { PredictAccountButton } from "./PredictAccountButton";
import { PredictDepositButton } from "./PredictDepositButton";
import { FundWalletModal } from "./FundWalletModal";
import { LanguageButton } from "./LanguageButton";
import en from "../locales/en.json";
import zh from "../locales/zh.json";
import en2 from "@liberfi.io/i18n/locales/en.json";
import zh2 from "@liberfi.io/i18n/locales/zh.json";

const mergedEn = { ...en, ...en2 };
const mergedZh = { ...zh, ...zh2 };

i18n.addResourceBundle("en", defaultNS, mergedEn, true, true);
i18n.addResourceBundle("zh", defaultNS, mergedZh, true, true);

const NoPrefetchLink: LinkComponentType = (props) => <Link prefetch={false} {...props} />;

const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

const navItemsConfig: Omit<NavItem, "label">[] = [
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
  { key: "markets", href: "/", icon: <ChartLineIcon width={20} height={20} /> },
  { key: "matches", href: "/matches", icon: <ZapFastIcon width={20} height={20} /> },
  { key: "portfolio", href: "/portfolio", icon: <UserIcon width={20} height={20} /> },
];

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export function AppLayout({ children, locale }: PropsWithChildren<{ locale: LocaleCode }>) {
  const localeApplied = useRef(false);
  if (!localeApplied.current) {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
    localeApplied.current = true;
  }

  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProviders>
        <LocaleProvider
          locale={locale}
          supportedLanguages={["en", "zh"]}
          resources={{
            en: mergedEn,
            zh: mergedZh,
          }}
        >
          <ServiceProviders>
            <PageShell>{children}</PageShell>
            <StyledToaster />
            <PredictSearchModal />
          </ServiceProviders>
        </LocaleProvider>
      </AuthProviders>
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Service providers (withPredict)
// ---------------------------------------------------------------------------

function ServiceProviders({ children }: PropsWithChildren) {
  const predictClient = useMemo(
    () => new PredictClient(baseUrl + process.env.NEXT_PUBLIC_PREDICT_URL),
    [],
  );

  // Live WebSocket client for orderbook/price/trade subscriptions. Falls back
  // to `null` when the env var is not configured, in which case the SDK's
  // realtime hooks transparently degrade to REST polling.
  const predictWsClient = useMemo(() => {
    const wsUrl = process.env.NEXT_PUBLIC_PREDICT_WS_URL;
    if (!wsUrl) return null;
    return new PredictWsClient({ wsUrl });
  }, []);

  return (
    <PredictProvider client={predictClient} wsClient={predictWsClient}>
      <PolymarketProvider>{children}</PolymarketProvider>
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

  const navItems: NavItem[] = useMemo(
    () =>
      navItemsConfig.map((item) => ({
        ...item,
        label: t(`extend.nav.${item.key}`) as string,
      })),
    [t],
  );

  useEffect(() => {
    navItemsConfig.forEach((item) => {
      if (item.href !== pathname) {
        router.prefetch(item.href);
      }
    });
  }, [router, pathname]);

  const onNavigate = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

  const { status: authStatus } = useAuth();
  const isAuthenticated = authStatus === "authenticated";

  const { onOpen: openPredictSearch, onClose: closePredictSearch } =
    useAsyncModal(PREDICT_SEARCH_MODAL_ID);

  const handlePredictHover = useCallback(
    (event: PredictEvent) => {
      router.prefetch(predictEventHref(event));
    },
    [router],
  );

  const searchModalParams = useMemo(
    () => ({
      getEventHref: (event: PredictEvent) => predictEventHref(event),
      LinkComponent: NoPrefetchLink,
      onHover: handlePredictHover,
    }),
    [handlePredictHover],
  );

  const handleSelectEvent = useCallback(
    (event: PredictEvent) => {
      router.push(predictEventHref(event));
      closePredictSearch();
    },
    [router, closePredictSearch],
  );

  return (
    <PredictWalletProvider enabled>
      <PredictWsConnector />
      <Scaffold
        pathname={pathname}
        onNavigate={onNavigate}
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
                <Logo icon={<LogoIcon />} miniIcon={<MiniLogoIcon />} />
                <div className="hidden sm:flex items-center gap-1 ml-2">
                  {navItems.map((item) => {
                    const active =
                      item.href === "/"
                        ? !navItemsConfig.some(
                            (other) => other.href !== "/" && pathname.startsWith(other.href),
                          )
                        : pathname.startsWith(item.href);
                    return (
                      <NavTab
                        key={item.key}
                        item={item}
                        active={active}
                        onNavigate={onNavigate}
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

              {/* Right: search icon (tablet/mobile) + language + balance + deposit + account */}
              <div className="shrink-0 ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPredictSearch({ params: searchModalParams })}
                  aria-label="Search"
                  className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-sm font-medium transition-colors border bg-zinc-800/60 text-zinc-300 border-zinc-700/50 hover:bg-zinc-800 hover:text-white cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <SearchIcon width={14} height={14} />
                </button>
                <div className="hidden sm:block">
                  <LanguageButton />
                </div>
                {isAuthenticated && <PredictBalanceIndicator />}
                {isAuthenticated && <PredictDepositButton />}
                <PredictAccountButton />
              </div>
            </div>
          </ScaffoldHeader>
        }
        footer={<ScaffoldFooter navItems={navItems} />}
      >
        {children}
      </Scaffold>
      <FundWalletModal />
    </PredictWalletProvider>
  );
}

// ---------------------------------------------------------------------------
// NavTab — inline header nav tab (used inside custom ScaffoldHeader children)
// ---------------------------------------------------------------------------

function NavTab({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: (href: string) => void;
}) {
  const handlePress = useCallback(() => {
    onNavigate(item.href);
  }, [onNavigate, item.href]);

  return (
    <button
      type="button"
      data-active={active}
      className={cn(
        "px-3 py-1.5 text-sm font-medium rounded-[10px] transition-colors cursor-pointer whitespace-nowrap focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        item.key === "worldcup" && "relative",
        active
          ? "text-[#c7ff2e]"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40",
      )}
      onClick={handlePress}
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
    </button>
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

function BalanceBreakdownContent({
  polymarketUsdcBalance,
  kalshiUsdcBalance,
  positionsCents,
  portfolioTotalCents,
  initialLoading,
}: {
  polymarketUsdcBalance: number | null;
  kalshiUsdcBalance: number | null;
  positionsCents: number;
  portfolioTotalCents: number;
  initialLoading: boolean;
}) {
  return (
    <>
      <div className="p-2">
        <div className="text-[11px] uppercase tracking-[0.05em] text-zinc-500 font-medium px-3 pt-1 pb-2">Cash Breakdown</div>
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-[10px]">
          <div className="flex items-center gap-2.5">
            <PolymarketIcon width={20} height={20} />
            <span className="text-sm text-zinc-400">Polymarket</span>
          </div>
          <span className="text-sm font-medium text-zinc-100 tabular-nums">
            {polymarketUsdcBalance != null ? `$${formatUsdc(polymarketUsdcBalance)}` : initialLoading ? "..." : "$0.00"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-[10px]">
          <div className="flex items-center gap-2.5">
            <KalshiIcon width={20} height={20} />
            <span className="text-sm text-zinc-400">Kalshi</span>
          </div>
          <span className="text-sm font-medium text-zinc-100 tabular-nums">
            {kalshiUsdcBalance != null ? `$${formatUsdc(kalshiUsdcBalance)}` : initialLoading ? "..." : "$0.00"}
          </span>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(39,39,42,1)" }} className="p-2">
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-[10px]">
          <div className="flex items-center gap-2.5">
            <ChartLineIcon width={20} height={20} className="text-bullish" />
            <span className="text-sm text-zinc-400">Positions</span>
          </div>
          <span className="text-sm font-medium text-zinc-100 tabular-nums">${formatCents(positionsCents)}</span>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(39,39,42,1)" }} className="p-2">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-sm text-zinc-300 font-medium">Portfolio Total</span>
          <span className="text-sm font-bold text-[#c7ff2e] tabular-nums">
            {initialLoading ? "..." : `$${formatCents(portfolioTotalCents)}`}
          </span>
        </div>
      </div>
    </>
  );
}

function PredictBalanceIndicator() {
  const {
    kalshiUsdcBalance,
    polymarketUsdcBalance,
    solanaAddress,
    evmAddress,
    isLoading: balanceLoading,
  } = usePredictWallet();
  const { isMobile } = useScreen();

  const { data: positionsData } = usePositionsMulti({
    kalshi_user: solanaAddress || undefined,
    polymarket_user: evmAddress || undefined,
  });

  const cashKalshiCents = toCents(kalshiUsdcBalance ?? 0);
  const cashPolymarketCents = toCents(polymarketUsdcBalance ?? 0);
  const cashTotalCents = cashKalshiCents + cashPolymarketCents;

  const positionsCents = useMemo(() => {
    const all = positionsData?.positions ?? [];
    let total = 0;
    for (const p of all) {
      total += p.current_value ?? p.size * (p.current_price ?? 0);
    }
    return toCents(total);
  }, [positionsData]);

  const portfolioTotalCents = cashTotalCents + positionsCents;

  const initialLoading =
    balanceLoading &&
    kalshiUsdcBalance === null &&
    polymarketUsdcBalance === null;

  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const breakdownProps = {
    polymarketUsdcBalance,
    kalshiUsdcBalance,
    positionsCents,
    portfolioTotalCents,
    initialLoading,
  };

  return (
    <div
      className="relative"
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Tablet & Mobile: USDC icon + total balance */}
      <button
        type="button"
        onClick={handleClick}
        className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 rounded-[10px] transition-colors cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <UsdcIcon width={16} height={16} aria-hidden="true" />
        <span className="text-xs font-medium text-zinc-100 tabular-nums">
          {initialLoading ? "..." : `$${formatCents(portfolioTotalCents)}`}
        </span>
      </button>

      {/* Desktop: full breakdown with cash + positions + chevron */}
      <button
        type="button"
        onClick={handleClick}
        className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 rounded-[10px] transition-colors cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <div className="flex items-center gap-1.5" title="Cash Balance">
          <UsdcIcon width={16} height={16} aria-hidden="true" />
          <span className="text-xs font-medium text-zinc-100 tabular-nums">
            {initialLoading ? "..." : `$${formatCents(cashTotalCents)}`}
          </span>
        </div>
        <div className="w-px h-4 bg-zinc-700/40" />
        <div className="flex items-center gap-1.5" title="Positions Value">
          <ChartLineIcon width={16} height={16} className="text-bullish" aria-hidden="true" />
          <span className="text-xs font-medium text-zinc-100 tabular-nums">
            ${formatCents(positionsCents)}
          </span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-zinc-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Mobile: modal overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setIsOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-sm mb-safe animate-in slide-in-from-bottom duration-200"
            style={{
              borderRadius: "14px 14px 0 0",
              border: "1px solid rgba(39,39,42,1)",
              borderBottom: "none",
              background: "rgba(24,24,27,1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-1 rounded-full bg-zinc-700" />
            </div>
            <BalanceBreakdownContent {...breakdownProps} />
            <div className="pb-safe" />
          </div>
        </div>
      )}

      {/* Tablet & Desktop: popover dropdown */}
      {!isMobile && isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 z-50 overflow-hidden"
          style={{
            borderRadius: 14,
            border: "1px solid rgba(39,39,42,1)",
            background: "rgba(24,24,27,1)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
        >
          <BalanceBreakdownContent {...breakdownProps} />
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
