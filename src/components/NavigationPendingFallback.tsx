import { EventsPageSkeleton } from "@liberfi.io/ui-predict";
import { PortfolioSkeleton } from "./page/portfolio-skeleton";
import { LeaderboardSkeleton } from "../features/leaderboard/components/skeletons";
import { SportsPageSkeleton } from "../features/sports/components/SportsPageSkeleton";
import { WorldCupTabSkeleton } from "../features/worldcup/components/skeletons";
import { normalizeTab } from "../features/worldcup/tabs";

/** Selects a loading layout that matches the destination's top-level section. */
export function NavigationPendingFallback({
  pathname,
}: {
  pathname: string;
}) {
  if (pathname.startsWith("/leaderboard")) return <LeaderboardSkeleton />;

  if (pathname.startsWith("/events")) return <EventsPageSkeleton />;

  if (
    pathname.startsWith("/sports") ||
    pathname.startsWith("/esports")
  ) {
    return <SportsPageSkeleton />;
  }

  if (pathname.startsWith("/portfolio")) {
    return (
      <div className="bg-zinc-950/50 sm:h-[calc(100vh-var(--header-height))] sm:min-h-0 sm:overflow-hidden">
        <div className="mx-auto h-full max-w-[1200px] px-2 pt-3 sm:flex sm:flex-col sm:px-6 sm:pt-8 lg:px-8">
          <PortfolioSkeleton />
        </div>
      </div>
    );
  }

  if (pathname.startsWith("/world-cup")) {
    const tab = normalizeTab(pathname.split("/")[2]);
    return (
      <div className="w-full pb-6 sm:pb-16">
        <div className="mx-auto w-full max-w-338 px-4 sm:px-6 sm:pt-4">
          <WorldCupTabSkeleton tab={tab} />
        </div>
      </div>
    );
  }

  return <GenericNavigationSkeleton />;
}

function GenericNavigationSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-800/70" />
      <div className="grid gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-lg border border-zinc-800/70 bg-zinc-900/50"
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-800/70 bg-zinc-950/40">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-14 animate-pulse border-b border-zinc-800/60 bg-zinc-900/30 last:border-b-0"
            style={{ animationDelay: `${index * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
