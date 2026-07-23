import { SportsListLoadingState } from "./SportsListLoadingState";

const PULSE = "animate-pulse rounded bg-zinc-800/60";

/** Mirrors the sports and esports page shell while server data is loading. */
export function SportsPageSkeleton() {
  return (
    <main
      data-testid="sports-skeleton"
      className="h-[calc(100dvh-var(--header-height))] overflow-hidden bg-zinc-950/50"
    >
      <div className="mx-auto flex h-full w-full max-w-[1440px]">
        <aside className="hidden w-56 shrink-0 border-r border-zinc-800/60 px-4 py-5 lg:block">
          <div className={`${PULSE} mb-5 h-6 w-24`} />
          <div className="space-y-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div
                key={index}
                className={`${PULSE} h-7`}
                style={{
                  width: `${72 + (index % 3) * 9}%`,
                  animationDelay: `${index * 60}ms`,
                }}
              />
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-zinc-800/60 px-3 pb-4 pt-4 sm:px-6 lg:px-8">
            <div className="mb-5 flex gap-2 overflow-hidden lg:hidden">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className={`${PULSE} h-8 w-20 shrink-0 rounded-full`}
                  style={{ animationDelay: `${index * 60}ms` }}
                />
              ))}
            </div>
            <div className={`${PULSE} h-7 w-32`} />
          </div>

          <div className="min-h-0 flex-1 px-3 py-4 sm:px-6 lg:px-8">
            <SportsListLoadingState loadingLabel="Loading" />
          </div>
        </section>
      </div>
    </main>
  );
}
