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
import { PredictClient, PredictProvider, usePredictWsClient } from "@liberfi.io/react-predict";
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
  WalletIcon,
  LogoIcon,
  MiniLogoIcon,
  cn,
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
import { predictEventHref } from "./page/predict-source";
import { queryClient } from "../libs/queryClient";
import { AuthProviders } from "./AuthProviders";
import { PredictAccountButton } from "./PredictAccountButton";
import { PredictDepositButton } from "./PredictDepositButton";
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
  { key: "markets", href: "/", icon: <ChartLineIcon width={20} height={20} /> },
  { key: "portfolio", href: "/portfolio", icon: <WalletIcon width={20} height={20} /> },
];

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export function AppLayout({ children, locale }: PropsWithChildren<{ locale: LocaleCode }>) {
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

  // TODO: re-enable when prediction WS backend is ready
  const predictWsClient = null;

  return (
    <PredictProvider client={predictClient} wsClient={predictWsClient}>
      {children}
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

  const { onClose: closePredictSearch } = useAsyncModal(PREDICT_SEARCH_MODAL_ID);

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
        headerVisible={["desktop", "tablet", "mobile"]}
        footerVisible={["mobile"]}
        header={
          <ScaffoldHeader>
            <div className="w-full h-full px-6 max-lg:px-4 max-sm:px-3 flex items-center gap-6 max-lg:gap-4 max-sm:gap-2">
              {/* Left: Logo + desktop nav tabs */}
              <div className="shrink-0 flex items-center gap-1">
                <Logo icon={<LogoIcon />} miniIcon={<MiniLogoIcon />} />
                <div className="hidden sm:flex items-center gap-1 ml-2">
                  {navItems.map((item) => (
                    <NavTab
                      key={item.key}
                      item={item}
                      active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              </div>

              {/* Center: Search bar */}
              <div className="flex-1 min-w-0">
                <SearchEventsButton
                  onSelectEvent={handleSelectEvent}
                  modalParams={searchModalParams}
                  className="w-full !min-w-0"
                />
              </div>

              {/* Right: actions (desktop shows all, mobile shows only Account) */}
              <div className="shrink-0 flex items-center gap-3 max-sm:gap-2">
                {isAuthenticated && (
                  <div className="hidden sm:block">
                    <PredictDepositButton />
                  </div>
                )}
                <div className="hidden sm:block">
                  <LanguageButton />
                </div>
                <PredictAccountButton />
              </div>
            </div>
          </ScaffoldHeader>
        }
        footer={<ScaffoldFooter navItems={navItems} />}
      >
        {children}
      </Scaffold>
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
        "h-8 text-sm font-medium px-2 xl:px-3 rounded-sm cursor-pointer whitespace-nowrap",
        "text-foreground hover:text-primary hover:bg-primary-50",
        "data-[active=true]:text-primary",
      )}
      onClick={handlePress}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
    >
      {item.label}
    </button>
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
