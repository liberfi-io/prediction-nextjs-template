import type { ReactNode } from "react";
import { WorldCupHero } from "src/features/worldcup/components/WorldCupHero";

export default function WorldCupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full pb-16">
      {/* Shared hero across every /world-cup sub-tab */}
      <WorldCupHero />

      <div className="mx-auto w-full max-w-338 px-4 pt-4 sm:px-6">
        {children}
      </div>
    </div>
  );
}
