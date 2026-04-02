"use client";

import { useCallback, useMemo, useState } from "react";
import encodeQR from "@paulmillr/qr";
import { useTranslation } from "@liberfi.io/i18n";
import { usePredictWallet } from "@liberfi.io/ui-predict";
import { truncateAddress } from "@liberfi.io/utils";
import {
  Button,
  StyledPopover,
  PopoverContent,
  PopoverTrigger,
  StyledSolidTabs,
  Tab,
  CopyIcon,
  CheckIcon,
  KalshiIcon,
  PolymarketIcon,
  SolanaIcon,
} from "@liberfi.io/ui";

function QRCodeImage({
  value,
  chainIcon,
}: {
  value: string;
  chainIcon?: React.ReactNode;
}) {
  const svgString = useMemo(() => {
    try {
      return encodeQR(value, "svg", { ecc: "high" });
    } catch {
      return null;
    }
  }, [value]);

  if (!svgString) return null;

  return (
    <div className="relative shrink-0" style={{ width: 152, height: 152 }}>
      <div
        className="rounded-lg overflow-hidden border border-border bg-white p-2 w-full h-full"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svgString }}
        aria-hidden="true"
      />
      {chainIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-full p-1 shadow-sm">
            {chainIcon}
          </div>
        </div>
      )}
    </div>
  );
}

function AddressRow({ address }: { address: string | undefined }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  if (!address) {
    return (
      <p className="text-xs text-neutral text-center">
        {t("extend.predict.deposit.walletNotConnected")}
      </p>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className="font-mono text-xs text-foreground">{truncateAddress(address)}</span>
      <Button
        size="sm"
        isIconOnly
        className="bg-content3 min-w-5 w-5 h-5 shrink-0"
        onPress={handleCopy}
        aria-label={t("extend.predict.deposit.copy")}
        disableRipple
      >
        {copied ? (
          <CheckIcon width={11} height={11} className="text-bullish" />
        ) : (
          <CopyIcon width={11} height={11} className="text-neutral" />
        )}
      </Button>
    </div>
  );
}

function DepositPanel({
  address,
  note,
  chainIcon,
}: {
  address: string | undefined;
  note?: string;
  chainIcon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-4 w-full">
      {address ? (
        <QRCodeImage value={address} chainIcon={chainIcon} />
      ) : (
        <div className="w-[152px] h-[152px] rounded-lg border border-border bg-content2 flex items-center justify-center">
          <span className="text-xs text-neutral">&mdash;</span>
        </div>
      )}

      <AddressRow address={address} />

      {note && (
        <p className="text-xs text-neutral text-center leading-relaxed">{note}</p>
      )}
    </div>
  );
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

function DepositIcon({ width = 13, height = 13 }: { width?: number; height?: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.5 1v8M3.5 6.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.5 11h10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PredictDepositButton() {
  const { t } = useTranslation();
  const { evmAddress, solanaAddress } = usePredictWallet();

  return (
    <StyledPopover placement="bottom-end" showArrow={false}>
      <PopoverTrigger>
        <Button
          size="sm"
          color="primary"
          radius="full"
          disableRipple
          aria-label={t("extend.predict.deposit.title")}
          startContent={<DepositIcon />}
        >
          {t("extend.predict.deposit.title")}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="w-[360px]">
          <StyledSolidTabs
            fullWidth
            size="sm"
            classNames={{ tabList: "mx-3 mt-3 mb-1", panel: "px-0 pt-0" }}
          >
            <Tab
              key="polymarket"
              title={
                <span className="flex items-center gap-1.5">
                  <PolymarketIcon width={14} height={14} />
                  Polymarket
                </span>
              }
            >
              <DepositPanel
                address={evmAddress}
                note={t("extend.predict.deposit.polymarketNote")}
                chainIcon={<PolygonIcon size={20} />}
              />
            </Tab>
            <Tab
              key="kalshi"
              title={<KalshiIcon width={46} height={14} />}
            >
              <DepositPanel
                address={solanaAddress}
                note={t("extend.predict.deposit.kalshiNote")}
                chainIcon={<SolanaIcon width={20} height={20} />}
              />
            </Tab>
          </StyledSolidTabs>
        </div>
      </PopoverContent>
    </StyledPopover>
  );
}
