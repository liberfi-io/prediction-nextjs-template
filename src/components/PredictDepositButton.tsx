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
      className="flex items-center gap-1 px-3 py-2 bg-[#c7ff2e]/10 hover:bg-[#c7ff2e]/20 border border-[#c7ff2e]/25 hover:border-[#c7ff2e]/40 text-[#c7ff2e] rounded-[10px] text-sm font-semibold transition-all duration-200 cursor-pointer"
    >
      {t("extend.predict.deposit.title")}
    </button>
  );
}
