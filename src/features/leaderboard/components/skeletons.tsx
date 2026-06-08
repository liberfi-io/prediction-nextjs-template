/**
 * Loading skeletons for the Smart Money leaderboard.
 *
 * Pure (no client hooks) so they can be used both as a server-side Suspense
 * fallback in the route `page.tsx` and inline while a React Query fetch is
 * pending. Mirrors the real master-detail layout so the first paint does not
 * shift.
 */

const cx = (...classes: string[]) => classes.join(" ");
const PULSE = "animate-pulse bg-zinc-800/50";

/** A single board row placeholder. */
function BoardRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className={cx("h-4 w-5 rounded", PULSE)} />
      <div className={cx("size-8 shrink-0 rounded-lg", PULSE)} />
      <div className="min-w-0 flex-1">
        <div className={cx("mb-1.5 h-3.5 w-24 rounded", PULSE)} />
        <div className={cx("h-3 w-16 rounded", PULSE)} />
      </div>
      <div className="text-right">
        <div className={cx("mb-1.5 h-3.5 w-16 rounded", PULSE)} />
        <div className={cx("ml-auto h-3 w-10 rounded", PULSE)} />
      </div>
    </div>
  );
}

/** Board rows-only skeleton (fills the scroll area; toggle rendered separately). */
export function BoardRowsSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/20">
      <div className="divide-y divide-zinc-800/40">
        {Array.from({ length: rows }).map((_, i) => (
          <BoardRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** Left board column skeleton (interval toggle + rows) — route Suspense fallback. */
export function BoardSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className={cx("h-8 w-20 rounded-[10px]", PULSE)} />
        <div className={cx("h-8 w-16 rounded-[10px]", PULSE)} />
      </div>
      <div className="divide-y divide-zinc-800/40 overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/20">
        {Array.from({ length: rows }).map((_, i) => (
          <BoardRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** A stat card placeholder. */
function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4">
      <div className={cx("mb-3 h-3 w-20 rounded", PULSE)} />
      <div className={cx("h-6 w-28 rounded", PULSE)} />
    </div>
  );
}

/** A list of row placeholders (used inside a virtualized tab body). */
export function DetailRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/20">
      <div className="divide-y divide-zinc-800/40">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className={cx("mb-1.5 h-3.5 w-2/3 rounded", PULSE)} />
              <div className={cx("h-3 w-1/3 rounded", PULSE)} />
            </div>
            <div className={cx("h-4 w-16 rounded", PULSE)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Right detail panel skeleton — fills the column height (stats fixed, rows fill). */
export function WalletDetailSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={cx("size-12 shrink-0 rounded-xl", PULSE)} />
          <div>
            <div className={cx("mb-2 h-4 w-36 rounded", PULSE)} />
            <div className={cx("h-3 w-24 rounded", PULSE)} />
          </div>
        </div>
        {/* Overview cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        {/* Performance grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-3">
              <div className={cx("mb-2 h-2.5 w-16 rounded", PULSE)} />
              <div className={cx("h-4 w-20 rounded", PULSE)} />
            </div>
          ))}
        </div>
      </div>
      {/* Tab rows */}
      <DetailRowsSkeleton />
    </div>
  );
}

/** Full page skeleton used as the route Suspense fallback. */
export function LeaderboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <div className={cx("mb-6 h-7 w-48 rounded", PULSE)} />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
        <div className="w-full lg:w-[400px] lg:shrink-0">
          <BoardSkeleton />
        </div>
        <div className="hidden min-w-0 flex-1 lg:block">
          <WalletDetailSkeleton />
        </div>
      </div>
    </div>
  );
}
