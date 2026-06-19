import { atom, type PrimitiveAtom } from "jotai";
import { isLikelyMpChatLaunch, isMpChatMiniAppEnabled } from "./launchParams";

function getInitialMpChatAutoLoginPending(): boolean {
  if (!isMpChatMiniAppEnabled()) return false;
  return isLikelyMpChatLaunch();
}

export const mpChatAutoLoginPendingAtom: PrimitiveAtom<boolean> = atom(
  getInitialMpChatAutoLoginPending(),
);
