import type { MouseEvent } from "react";

/** Returns whether an anchor click should use the app's same-window flow. */
export function isPlainSameWindowNavigation(
  event: MouseEvent<HTMLAnchorElement>,
): boolean {
  const target = event.currentTarget.getAttribute("target");
  return (
    (!target || target === "_self") &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}
