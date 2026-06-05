import type { ReactNode } from "react";

/**
 * Layout for World Cup match detail pages. Isolated from the tab list pages via
 * the `(detail)` route group: no hero, and a full-bleed (no max-width) container
 * so the multi-column detail layout can use the entire viewport width.
 */
export default function WorldCupDetailLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="w-full pb-16">
      <div className="w-full px-3 pt-4 sm:px-6">{children}</div>
    </div>
  );
}
