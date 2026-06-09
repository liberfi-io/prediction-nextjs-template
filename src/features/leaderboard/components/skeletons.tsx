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

/** Mirror of {@link SmartMoneyBoard}'s `ROW_GRID` so header + rows align. */
const BOARD_ROW_GRID =
  "grid grid-cols-[44px_minmax(120px,1fr)_120px_104px_104px_116px_72px] items-center gap-3";
/** Mirror of {@link SmartMoneyBoard}'s `TABLE_MIN_W`. */
const BOARD_TABLE_MIN_W = "min-w-[820px] md:min-w-0";
/** Mirror of {@link SmartMoneyBoard}'s `HERO_BG`. */
const HERO_BG =
  "radial-gradient(130% 150% at 12% 0%, rgba(199,255,46,0.13), transparent 52%), linear-gradient(180deg, #0e1109 0%, #0a0a0b 100%)";

/** A single board row placeholder (mirrors the 7-column table row). */
function BoardRowSkeleton({ last }: { last?: boolean }) {
  return (
    <div className={cx(BOARD_ROW_GRID, "px-3 py-3", last ? "" : "border-b border-zinc-800/40")}>
      {/* rank */}
      <div className="flex justify-center">
        <div className={cx("size-6 rounded-full", PULSE)} />
      </div>
      {/* trader: avatar + two-line address/meta */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={cx("size-8 shrink-0 rounded-full", PULSE)} />
        <div className="min-w-0">
          <div className={cx("mb-1.5 h-3.5 w-24 rounded", PULSE)} />
          <div className={cx("h-3 w-14 rounded", PULSE)} />
        </div>
      </div>
      {/* net pnl + ratio */}
      <div className="flex flex-col items-end gap-1.5">
        <div className={cx("h-3.5 w-16 rounded", PULSE)} />
        <div className={cx("h-3 w-10 rounded", PULSE)} />
      </div>
      {/* win rate + avg bet */}
      <div className="flex flex-col items-end gap-1.5">
        <div className={cx("h-3.5 w-12 rounded", PULSE)} />
        <div className={cx("h-3 w-14 rounded", PULSE)} />
      </div>
      {/* balance */}
      <div className="flex justify-end">
        <div className={cx("h-3.5 w-14 rounded", PULSE)} />
      </div>
      {/* vol / txs */}
      <div className="flex flex-col items-end gap-1.5">
        <div className={cx("h-3.5 w-14 rounded", PULSE)} />
        <div className={cx("h-3 w-10 rounded", PULSE)} />
      </div>
      {/* last trade */}
      <div className="flex justify-end">
        <div className={cx("h-3 w-10 rounded", PULSE)} />
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

/**
 * Board table skeleton (the hero + podium are rendered separately). Mirrors the
 * real {@link BoardTable}: a screen-filling bounded box with a 7-column header
 * fixed on top and column-aligned rows below; horizontally scrollable on narrow
 * screens.
 */
export function BoardRowsSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="flex h-[calc(100dvh-152px-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/20 sm:h-[calc(100dvh-96px)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
        <div className={cx(BOARD_TABLE_MIN_W, "flex min-h-0 flex-1 flex-col")}>
          {/* Column header */}
          <div className={cx(BOARD_ROW_GRID, "shrink-0 border-b border-zinc-800/50 px-3 py-2.5")}>
            <div className={cx("mx-auto h-3 w-4 rounded", PULSE)} />
            <div className={cx("h-3 w-16 rounded", PULSE)} />
            <div className={cx("ml-auto h-3 w-14 rounded", PULSE)} />
            <div className={cx("ml-auto h-3 w-12 rounded", PULSE)} />
            <div className={cx("ml-auto h-3 w-14 rounded", PULSE)} />
            <div className={cx("ml-auto h-3 w-16 rounded", PULSE)} />
            <div className={cx("ml-auto h-3 w-12 rounded", PULSE)} />
          </div>
          {/* Rows */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {Array.from({ length: rows }).map((_, i) => (
              <BoardRowSkeleton key={i} last={i === rows - 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Summary card shell: bordered surface + small uppercase title placeholder. */
function CardShellSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4">
      <div className={cx("mb-3 h-3 w-24 rounded", PULSE)} />
      {children}
    </div>
  );
}

/** `label · value` rows used by the TOTAL VALUE / PERFORMANCE & BIAS cards. */
function StatRowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-2">
          <div className={cx("h-3 w-20 rounded", PULSE)} />
          <div className={cx("h-3.5 w-16 rounded", PULSE)} />
        </div>
      ))}
    </div>
  );
}

/** Best/worst trade block placeholder (label + market title + signed pnl). */
function TradeBlockSkeleton() {
  return (
    <div className="mt-3 border-t border-zinc-800/60 pt-3">
      <div className={cx("mb-1.5 h-2.5 w-20 rounded", PULSE)} />
      <div className={cx("mb-1.5 h-3 w-3/4 rounded", PULSE)} />
      <div className={cx("h-3.5 w-16 rounded", PULSE)} />
    </div>
  );
}

/** Card 1 — TOTAL VALUE: 4 label/value rows. */
export function TotalValueCardSkeleton() {
  return (
    <CardShellSkeleton>
      <StatRowsSkeleton rows={4} />
    </CardShellSkeleton>
  );
}

/** Card 2 — PERFORMANCE & BIAS: 9 label/value rows + best/worst trade blocks. */
export function PerformanceBiasCardSkeleton() {
  return (
    <CardShellSkeleton>
      <StatRowsSkeleton rows={9} />
      <TradeBlockSkeleton />
      <TradeBlockSkeleton />
    </CardShellSkeleton>
  );
}

/** Card 3 — YIELD & RISK: 2-column metric grid + exposure bar + legend. */
export function YieldRiskCardSkeleton() {
  return (
    <CardShellSkeleton>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className={cx("mb-1.5 h-2.5 w-16 rounded", PULSE)} />
            <div className={cx("h-3.5 w-14 rounded", PULSE)} />
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className={cx("mb-1.5 h-2.5 w-20 rounded", PULSE)} />
        <div className={cx("h-2 w-full rounded-full", PULSE)} />
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={cx("h-3 w-16 rounded", PULSE)} />
          ))}
        </div>
      </div>
    </CardShellSkeleton>
  );
}

/**
 * Positions table placeholder — mirrors the real bordered table: a column
 * header row plus rows of `avatar + two-line market title + right-aligned
 * numeric cells`.
 */
function PositionsTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/20">
      {/* Column header */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800/50 px-3 py-2.5">
        <div className={cx("h-3 w-16 rounded", PULSE)} />
        <div className="hidden items-center gap-4 sm:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cx("h-3 w-12 rounded", PULSE)} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-zinc-800/40">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-3">
            <div className={cx("size-[34px] shrink-0 rounded-md", PULSE)} />
            <div className="min-w-0 flex-1">
              <div className={cx("mb-1.5 h-3.5 w-2/3 rounded", PULSE)} />
              <div className={cx("h-3 w-1/3 rounded", PULSE)} />
            </div>
            <div className="hidden items-center gap-4 sm:flex">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className={cx("h-3.5 w-12 rounded", PULSE)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Right detail panel skeleton — mirrors the header + 3-card + tabs + table layout. */
export function WalletDetailSkeleton({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header: back button + avatar + address/meta */}
      <div className="flex items-center gap-3">
        {onBack && <div className={cx("size-9 shrink-0 rounded-lg", PULSE)} />}
        <div className={cx("size-11 shrink-0 rounded-xl", PULSE)} />
        <div>
          <div className={cx("mb-2 h-4 w-36 rounded", PULSE)} />
          <div className={cx("h-3 w-28 rounded", PULSE)} />
        </div>
      </div>
      {/* Three summary cards — each mirrors its real card's structure */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <TotalValueCardSkeleton />
        <PerformanceBiasCardSkeleton />
        <YieldRiskCardSkeleton />
      </div>
      {/* Tabs bar (tab pills + search input) */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/50 pb-2">
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cx("h-5 w-16 rounded", PULSE)} />
          ))}
        </div>
        <div className={cx("h-7 w-[140px] rounded-lg sm:w-[200px]", PULSE)} />
      </div>
      {/* Default tab is the positions table */}
      <PositionsTableSkeleton />
    </div>
  );
}

/** Full page skeleton used as the route Suspense fallback. */
export function LeaderboardSkeleton() {
  return (
    <>
      {/* Fixed secondary menu — single visible tab (Smart Money) */}
      <div className="fixed inset-x-0 top-12 z-30 border-b border-zinc-800/60 bg-[#0a0a0b]/95">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-10 xl:px-12">
          <div className={cx("h-8 w-28 rounded-lg", PULSE)} />
        </div>
      </div>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 pt-[60px] sm:px-6 lg:px-10 xl:px-12">
        {/* Hero: gradient surface, title + scoped tag + subtitle, interval toggle */}
        <div
          className="relative overflow-hidden rounded-2xl border border-zinc-800/60 px-4 pb-5 pt-5 sm:px-6 sm:pb-6"
          style={{ background: HERO_BG }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <div className={cx("h-7 w-40 rounded", PULSE)} />
                <div className={cx("h-5 w-24 rounded-full", PULSE)} />
              </div>
              <div className={cx("h-4 w-48 rounded", PULSE)} />
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={cx("h-6 w-12 rounded-lg", PULSE)} />
              ))}
            </div>
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
