import type { ReactNode } from "react";
import { WorldCupHero } from "src/features/worldcup/components/WorldCupHero";
import { WorldCupSubTabs } from "src/features/worldcup/components/WorldCupSubTabs";

/**
 * Layout for the World Cup tab list pages (Games / Groups / Bracket / Props):
 * shared hero on top and a narrow centred container. Isolated from the match
 * detail pages via the `(list)` route group so the detail layout can drop the
 * hero and widen the container without affecting these.
 *
 * The sub-tab nav lives here (not in the page) so it persists across tab
 * navigations — switching tabs only swaps the page content below it.
 */
export default function WorldCupListLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="w-full pb-16">
      {/* Shared hero across every /world-cup sub-tab */}
      <WorldCupHero />

      <div className="mx-auto w-full max-w-338 px-4 pt-4 sm:px-6">
        <WorldCupSubTabs />
        {children}
      </div>
    </div>
  );
}
