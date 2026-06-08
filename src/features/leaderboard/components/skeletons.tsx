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

/** A single board row placeholder (mirrors the multi-column table row). */
function BoardRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className={cx("h-4 w-5 rounded", PULSE)} />
      <div className={cx("size-8 shrink-0 rounded-full", PULSE)} />
      <div className="min-w-0 flex-1">
        <div className={cx("mb-1.5 h-3.5 w-28 rounded", PULSE)} />
        <div className={cx("h-3 w-16 rounded", PULSE)} />
      </div>
      <div className="text-right">
        <div className={cx("mb-1.5 h-3.5 w-16 rounded", PULSE)} />
        <div className={cx("ml-auto h-3 w-10 rounded", PULSE)} />
      </div>
    </div>
  );
}

/** Top-3 podium placeholder (mirrors the fixed-height podium cards). */
export function PodiumSkeleton() {
  // [side, champion, side] heights mirror the real card heights.
  const cards = [
    { w: "w-[156px] sm:w-[240px]", h: "h-[228px] sm:h-[268px]", emblem: 76 },
    { w: "w-[180px] sm:w-[268px]", h: "h-[256px] sm:h-[304px]", emblem: 96 },
    { w: "w-[156px] sm:w-[240px]", h: "h-[228px] sm:h-[268px]", emblem: 76 },
  ];
  return (
    <div className="flex items-end justify-center gap-3 px-2 sm:gap-4">
      {cards.map((c, i) => (
        <div
          key={i}
          className={cx(
            "flex flex-col items-center gap-3 rounded-2xl border border-zinc-800/40 bg-zinc-900/40 px-4 pb-[18px] pt-[22px]",
            c.w,
            c.h,
          )}
        >
          <div className={cx("h-5 w-16 rounded-full", PULSE)} />
          <div className={cx("rounded-full", PULSE)} style={{ width: c.emblem, height: c.emblem }} />
          <div className={cx("h-3.5 w-20 rounded", PULSE)} />
          <div className={cx("h-6 w-24 rounded", PULSE)} />
        </div>
      ))}
    </div>
  );
}

/** Board table skeleton (rows only); the hero + podium are rendered separately. */
export function BoardRowsSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="min-h-[calc(100dvh-180px)] overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/20">
      <div className="border-b border-zinc-800/50 px-3 py-2.5">
        <div className={cx("h-3 w-full max-w-md rounded", PULSE)} />
      </div>
      <div className="divide-y divide-zinc-800/40">
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
    <>
      {/* Fixed secondary menu */}
      <div className="fixed inset-x-0 top-12 z-30 border-b border-zinc-800/60 bg-[#0a0a0b]/95">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className={cx("h-4 w-16 rounded", PULSE)} />
          <div className={cx("h-8 w-28 rounded-lg", PULSE)} />
          <div className={cx("h-8 w-28 rounded-lg", PULSE)} />
        </div>
      </div>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 pb-10 pt-[60px] sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 px-4 pb-6 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={cx("mb-2 h-7 w-48 rounded", PULSE)} />
              <div className={cx("h-4 w-40 rounded", PULSE)} />
            </div>
            <div className={cx("h-8 w-48 rounded-xl", PULSE)} />
          </div>
          <div className="mt-6">
            <PodiumSkeleton />
          </div>
        </div>
        <BoardRowsSkeleton />
      </div>
    </>
  );
}
