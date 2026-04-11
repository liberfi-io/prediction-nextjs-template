"use client";

import { useCallback } from "react";
import { useTranslation } from "@liberfi.io/i18n";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import { FUND_WALLET_MODAL_ID } from "./FundWalletModal";

export function PredictDepositButton() {
  const { t } = useTranslation();
  const { onOpen } = useAsyncModal(FUND_WALLET_MODAL_ID);

  const handlePress = useCallback(() => {
    onOpen();
  }, [onOpen]);

  return (
    <button
      type="button"
      aria-label={t("extend.predict.deposit.title")}
      onClick={handlePress}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c7ff2e]/10 hover:bg-[#c7ff2e]/20 border border-[#c7ff2e]/25 hover:border-[#c7ff2e]/40 text-[#c7ff2e] rounded-[10px] text-xs font-semibold transition-colors duration-200 cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
      <span className="hidden sm:inline">{t("extend.predict.deposit.title")}</span>
    </button>
  );
}
