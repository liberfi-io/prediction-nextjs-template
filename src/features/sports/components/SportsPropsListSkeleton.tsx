import { SportsPropsGrid } from "./SportsPropsGrid";

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
            <div className="flex min-h-[248px] flex-col overflow-hidden rounded-[14px] border border-zinc-800/60 bg-zinc-900/40">
              <div className="flex items-center gap-2.5 px-3.5 pb-2 pt-3.5">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-[10px] bg-zinc-800/60" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div
                    className={`h-3 animate-pulse rounded bg-zinc-800/60 ${
                      index % 2 === 0 ? "w-4/5" : "w-3/5"
                    }`}
                  />
                  <div className="h-2.5 w-2/5 animate-pulse rounded bg-zinc-800/50" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 px-3.5 py-2">
                {Array.from({ length: 3 }).map((_, row) => (
                  <div
                    key={row}
                    className="flex items-center justify-between gap-3 rounded-lg bg-zinc-800/35 px-3 py-2.5"
                  >
                    <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-700/50" />
                    <div className="h-3 w-12 animate-pulse rounded bg-zinc-700/50" />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-zinc-800/60 px-3.5 py-3">
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
