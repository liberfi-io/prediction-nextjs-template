import { atom, type PrimitiveAtom } from "jotai";
import { isLikelyTelegramMiniAppLaunch } from "./launchParams";

function getInitialTelegramMiniAppAutoLoginPending(): boolean {
  return isLikelyTelegramMiniAppLaunch();
}

export const telegramMiniAppAutoLoginPendingAtom: PrimitiveAtom<boolean> = atom(
  getInitialTelegramMiniAppAutoLoginPending(),
);
