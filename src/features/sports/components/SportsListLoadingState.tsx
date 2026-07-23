const SPORTS_LIST_LOADING_LINE_WIDTHS = ["68%", "54%", "74%", "48%", "62%"];

/** Renders the shared pulse-line loading state for sports lists. */
export function SportsListLoadingState({
  loadingLabel,
}: {
  loadingLabel: string;
}) {
  return (
    <div data-sports-list-loading="true" className="w-full py-3">
      <span className="sr-only" role="status">
        {loadingLabel}
      </span>
      <div aria-hidden="true" className="space-y-2 px-1">
        {SPORTS_LIST_LOADING_LINE_WIDTHS.map((width, index) => (
          <div
            key={width}
            data-testid="sports-list-loading-row"
            className="flex h-7 items-center gap-3"
          >
            <span
              className="h-3 w-16 shrink-0 animate-pulse rounded bg-zinc-800/55"
              style={{ animationDelay: `${index * 80}ms` }}
            />
            <span
              className="h-4 max-w-2xl animate-pulse rounded bg-zinc-800/70"
              style={{
                width,
                animationDelay: `${index * 80 + 40}ms`,
              }}
            />
            <span
              className="ml-auto hidden h-3 w-20 shrink-0 animate-pulse rounded bg-zinc-800/50 sm:block"
              style={{ animationDelay: `${index * 80 + 80}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
