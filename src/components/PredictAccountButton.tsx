"use client";

import { useCallback } from "react";
import {
  LocaleCode,
  useTranslation,
  useLocale,
  useChangeLocale,
  useLocaleContext,
} from "@liberfi.io/i18n";
import { useAuth } from "@liberfi.io/wallet-connector";
import { usePredictWallet } from "@liberfi.io/ui-predict";
import {
  Button,
  Spinner,
  StyledPopover,
  PopoverContent,
  PopoverTrigger,
  SignInIcon,
  SignOutIcon,
  PolymarketIcon,
  KalshiIcon,
  SolanaIcon,
  UsdcIcon,
  ChevronDownIcon,
  TranslateIcon,
  useDisclosure,
  cn,
} from "@liberfi.io/ui";
import { PredictDepositButton } from "./PredictDepositButton";

function formatUsdc(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function PolygonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 38 33"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Polygon"
    >
      <path
        d="M29 10.2a2.2 2.2 0 0 0-2.1 0l-4.8 2.8-3.3 1.9-4.8 2.8a2.2 2.2 0 0 1-2.1 0l-3.8-2.2a2.1 2.1 0 0 1-1.1-1.9V9.5c0-.8.4-1.5 1.1-1.9l3.8-2.1a2.2 2.2 0 0 1 2.1 0l3.8 2.1c.7.4 1.1 1.1 1.1 1.9v2.8l3.3-1.9V7.6a2.1 2.1 0 0 0-1.1-1.9L16.1.5a2.2 2.2 0 0 0-2.1 0L7.1 4.4a2 2 0 0 0-.5.4L6.4 5A2.1 2.1 0 0 0 6 6.4v9.9c0 .8.4 1.5 1.1 1.9l6.9 4a2.2 2.2 0 0 0 2.1 0l4.8-2.7 3.3-1.9 4.8-2.8a2.2 2.2 0 0 1 2.1 0l3.8 2.2c.7.4 1.1 1.1 1.1 1.9v4a2.1 2.1 0 0 1-1.1 1.8l-3.7 2.2a2.2 2.2 0 0 1-2.1 0l-3.8-2.2a2.1 2.1 0 0 1-1.1-1.9v-2.8l-3.3 1.9v2.8c0 .8.4 1.5 1.1 1.9l6.9 4a2.2 2.2 0 0 0 2.1 0l6.9-4a2.1 2.1 0 0 0 1.1-1.9v-8c0-.8-.4-1.5-1.1-1.9L29 10.2Z"
        fill="#8247E5"
      />
    </svg>
  );
}

function BalanceRow({
  label,
  chainIcon,
  chainName,
  balance,
}: {
  label: React.ReactNode;
  chainIcon: React.ReactNode;
  chainName: string;
  balance: number | null;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
        <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
          {label}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-neutral">
          {chainIcon}
          {chainName}
        </span>
      </div>
      <span className="text-xs font-semibold text-foreground tabular-nums">
        ${formatUsdc(balance ?? 0)}
      </span>
    </div>
  );
}

export function PredictAccountButton() {
  const { t } = useTranslation();
  const { status, signIn, signOut } = useAuth();
  const { dflowUsdcBalance, polymarketUsdcBalance, isLoading } = usePredictWallet();
  const { isOpen, onOpenChange, onClose } = useDisclosure();

  const totalBalance = (dflowUsdcBalance ?? 0) + (polymarketUsdcBalance ?? 0);

  const handleSignOut = useCallback(async () => {
    onClose();
    await signOut();
  }, [signOut, onClose]);

  if (status === "unauthenticated") {
    return (
      <Button
        size="sm"
        color="primary"
        radius="full"
        disableRipple
        onPress={signIn}
        startContent={<SignInIcon width={14} height={14} />}
      >
        {t("common.signIn")}
      </Button>
    );
  }

  if (status === "authenticating" || status === "deauthenticating") {
    return (
      <Button
        size="sm"
        radius="full"
        isDisabled
        disableRipple
        className="bg-content2 h-8 min-h-0 px-3"
      >
        <Spinner size="sm" color="current" />
      </Button>
    );
  }

  return (
    <StyledPopover
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="bottom-end"
      showArrow={false}
    >
      <PopoverTrigger>
        <Button
          size="sm"
          disableRipple
          className="bg-content2 h-8 min-h-0 px-3 rounded-full"
          startContent={
            <UsdcIcon width={16} height={16} className="shrink-0" />
          }
          endContent={
            <ChevronDownIcon
              width={12}
              height={12}
              className={cn(
                "text-neutral transition-transform duration-200 shrink-0",
                isOpen && "rotate-180",
              )}
            />
          }
        >
          {isLoading ? (
            <Spinner size="sm" color="current" />
          ) : (
            <span className="text-xs font-semibold tabular-nums">
              ${formatUsdc(totalBalance)}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent>
        <div className="w-[260px] py-2">
          {/* Balance overview */}
          <div className="flex items-center gap-2 px-4 pb-2 border-b border-border">
            <UsdcIcon width={18} height={18} className="shrink-0" />
            <span className="flex-1 text-sm font-semibold text-foreground">
              {t("extend.predict.account.totalBalance")}
            </span>
            <span className="text-sm font-bold tabular-nums">
              ${formatUsdc(totalBalance)}
            </span>
          </div>

          <div className="pt-1">
            <BalanceRow
              label={
                <>
                  <PolymarketIcon width={16} height={16} className="shrink-0" />
                  {"Polymarket"}
                </>
              }
              chainIcon={<PolygonIcon size={12} />}
              chainName="Polygon"
              balance={polymarketUsdcBalance}
            />
            <BalanceRow
              label={<KalshiIcon width={46} height={14} />}
              chainIcon={<SolanaIcon width={12} height={12} />}
              chainName="Solana"
              balance={dflowUsdcBalance}
            />
          </div>

          {/* Mobile-only: Deposit */}
          <div className="sm:hidden mt-1 pt-1 border-t border-border px-2">
            <PredictDepositButton />
          </div>

          {/* Mobile-only: Language switcher */}
          <div className="sm:hidden mt-1 pt-1 border-t border-border px-4">
            <MobileLanguageSwitcher />
          </div>

          {/* Sign out */}
          <div className="mt-1 pt-1 border-t border-border px-4 pb-1">
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-danger transition-colors hover:text-danger/80"
              onClick={handleSignOut}
            >
              <SignOutIcon width={15} height={15} />
              <span className="text-sm">{t("common.signOut")}</span>
            </button>
          </div>
        </div>
      </PopoverContent>
    </StyledPopover>
  );
}

// ---------------------------------------------------------------------------
// Mobile-only language switcher inside account dropdown
// ---------------------------------------------------------------------------

function MobileLanguageSwitcher() {
  const { t } = useTranslation();
  const locale = useLocale();
  const changeLocale = useChangeLocale();
  const { languages } = useLocaleContext();

  const handleChange = useCallback(
    (code: LocaleCode) => changeLocale(code),
    [changeLocale],
  );

  return (
    <div className="flex items-center gap-2 py-2">
      <TranslateIcon width={15} height={15} className="text-neutral shrink-0" />
      <span className="text-sm text-foreground flex-1">{t("extend.header.language")}</span>
      <div className="flex gap-1">
        {languages.map((lang) => (
          <button
            key={lang.localCode}
            type="button"
            onClick={() => handleChange(lang.localCode as LocaleCode)}
            className={cn(
              "text-xs px-2 py-1 rounded-md cursor-pointer transition-colors",
              lang.localCode === locale
                ? "bg-content2 text-foreground font-medium"
                : "text-neutral hover:text-foreground",
            )}
          >
            {lang.localCode.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
