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
  Key,
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
  useLocale,
  useChangeLocale,
  useLocaleContext,
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
import {
  StyledToaster,
  CoinsIcon,
  LogoIcon,
  MiniLogoIcon,
  TranslateIcon,
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
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { predictEventHref } from "./page/predict-source";
import { queryClient } from "../libs/queryClient";
import { AuthProviders } from "./AuthProviders";
import { PredictDepositButton } from "./PredictDepositButton";
import { PredictAccountButton } from "./PredictAccountButton";
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
  { key: "predict", href: "/", icon: <CoinsIcon width={20} height={20} /> },
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

  const { onClose: closePredictSearch } = useAsyncModal(PREDICT_SEARCH_MODAL_ID);

  const handlePredictHover = useCallback(
    (event: PredictEvent) => {
      router.prefetch(predictEventHref(event));
    },
    [router],
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
          <ScaffoldHeader
            left={<Logo icon={<LogoIcon />} miniIcon={<MiniLogoIcon />} />}
            navItems={navItems}
            right={
              <>
                <SearchEventsButton
                  onSelectEvent={(event) => {
                    router.push(predictEventHref(event));
                    closePredictSearch();
                  }}
                  modalParams={{
                    getEventHref: (event) => predictEventHref(event),
                    LinkComponent: NoPrefetchLink,
                    onHover: handlePredictHover,
                  }}
                />

                <PredictDepositButton />

                <LanguageButton />

                <PredictAccountButton />
              </>
            }
          />
        }
        footer={<ScaffoldFooter navItems={navItems} />}
      >
        {children}
      </Scaffold>
    </PredictWalletProvider>
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

// ---------------------------------------------------------------------------
// Header action buttons
// ---------------------------------------------------------------------------

function LanguageButton() {
  const { t } = useTranslation();
  const locale = useLocale();
  const changeLocale = useChangeLocale();
  const { languages } = useLocaleContext();

  const handleChangeLanguage = useCallback(
    (key: Key) => changeLocale(key as LocaleCode),
    [changeLocale],
  );

  return (
    <Dropdown
      placement="bottom-end"
      size="sm"
      classNames={{ content: "bg-content1 border border-border" }}
    >
      <DropdownTrigger>
        <Button
          isIconOnly
          className="bg-content2 w-8 min-w-0 h-8 min-h-0 rounded-full"
          disableRipple
          aria-label={t("extend.header.language")}
        >
          <TranslateIcon width={16} height={16} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={t("extend.header.language")}
        selectionMode="single"
        selectedKeys={[locale]}
        onAction={handleChangeLanguage}
        classNames={{ list: "gap-1" }}
        itemClasses={{
          base: cn("rounded-md px-3 h-8"),
        }}
      >
        {languages.map((lang) => (
          <DropdownItem
            key={lang.localCode}
            className={cn(
              lang.localCode === locale ? "bg-content2 text-foreground" : "text-neutral",
              "data-[hover=true]:bg-content2 data-[hover=true]:text-foreground",
              "data-[selectable=true]:focus:bg-content2 data-[selectable=true]:focus:text-foreground",
            )}
          >
            {lang.displayName}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
