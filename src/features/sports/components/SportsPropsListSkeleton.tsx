import { SPORTS_CARD_SURFACE_CLASS } from "./sportsCardSurface";
import {
  SPORTS_PROP_CARD_HEIGHT_CLASS,
  SportsPropsGrid,
} from "./SportsPropsGrid";

/** Renders a loading state shaped like the sports props event-card grid. */
export function SportsPropsListSkeleton({
  loadingLabel,
}: {
  loadingLabel: string;
}) {
  return (
    <SportsPropsGrid data-sports-props-list-loading="true">
      <span className="sr-only" role="status">
        {loadingLabel}
      </span>
      <div
        className="sports-props-skeleton-grid grid grid-cols-2"
        aria-hidden="true"
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="p-2">
            <div
              data-testid="sports-prop-skeleton-card"
              className={`flex flex-col ${SPORTS_PROP_CARD_HEIGHT_CLASS} ${SPORTS_CARD_SURFACE_CLASS}`}
            >
              <div className="flex flex-1 flex-col gap-2 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-zinc-800/60 sm:h-12 sm:w-12" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div
                      className={`h-3.5 animate-pulse rounded bg-zinc-800/60 ${
                        index % 2 === 0 ? "w-4/5" : "w-3/5"
                      }`}
                    />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-y-0.5 lg:gap-y-2">
                  {Array.from({ length: 3 }).map((_, row) => (
                    <div
                      key={row}
                      className="flex h-9 items-center justify-between gap-2"
                    >
                      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800/60" />
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="h-4 w-10 animate-pulse rounded bg-zinc-800/60" />
                        <div className="h-7 w-[85px] animate-pulse rounded-lg bg-zinc-800/60 lg:h-9 lg:w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex min-h-9 items-center justify-between gap-3 border-t border-zinc-800/50 bg-zinc-800/15 px-3.5 py-2">
                <div className="h-2.5 w-20 animate-pulse rounded bg-zinc-800/60" />
                <div className="h-2.5 w-12 animate-pulse rounded bg-zinc-800/60" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SportsPropsGrid>
  );
}
