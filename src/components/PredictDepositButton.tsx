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
      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
    >
      {t("extend.predict.deposit.title")}
    </button>
  );
}
