/**
 * Loading skeletons for the World Cup tabs.
 *
 * These are pure (no client hooks) so they can be used both as a server-side
 * Suspense fallback in the route `page.tsx` and inline inside the client tab
 * components while a React Query poll is still pending (e.g. when the SSR
 * prefetch timed out). Each skeleton mirrors the real content shape so the
 * first paint does not shift the layout.
 */

import type { WcTab } from "../tabs";

/**
 * Local class joiner. Deliberately avoids importing `cn` from `@liberfi.io/ui`,
 * whose barrel pulls client-only modules into this otherwise server-safe file
 * (used as a Suspense fallback in the server `page.tsx`).
 */
const cx = (...classes: string[]) => classes.join(" ");

const PULSE = "animate-pulse bg-zinc-800/50";
const CARD = "rounded-[12px] border border-zinc-800 bg-zinc-900/40";

// Mirrors MatchCard's box model (header + desktop 3-odds-column body / mobile
// matchup + moneyline-row body) so the skeleton card height matches the real
// card by construction — the odds columns drive the height, not a guessed
// fixed value, so there's no jump when content loads.
function MatchCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[rgba(39,39,42,0.6)] bg-[rgba(24,24,27,0.4)]">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 sm:px-4">
        <div className={cx("h-4 w-28 rounded", PULSE)} />
        <div className="flex shrink-0 items-center gap-1.5">
          <div className={cx("h-[26.5px] w-16 rounded-full", PULSE)} />
          <div className={cx("hidden h-[26.5px] w-20 rounded-full md:block", PULSE)} />
        </div>
      </div>

      {/* Desktop body (>= md): matchup + 3 odds columns. */}
      <div className="hidden items-stretch gap-3 px-4 pb-3 pt-2.5 md:flex">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <div className="flex items-center gap-2.5">
            <div className={cx("size-7 shrink-0 rounded-full", PULSE)} />
            <div className={cx("h-4 w-28 rounded", PULSE)} />
          </div>
          <div className="flex items-center gap-2.5">
            <div className={cx("size-7 shrink-0 rounded-full", PULSE)} />
            <div className={cx("h-4 w-24 rounded", PULSE)} />
          </div>
        </div>
        <div className="flex shrink-0 items-stretch gap-2">
          <div className="flex w-[128px] flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={cx("h-[34px] rounded-[9px]", PULSE)} />
            ))}
          </div>
          {Array.from({ length: 2 }).map((_, c) => (
            <div key={c} className="flex w-[128px] flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className={cx("min-h-[34px] flex-1 rounded-[9px]", PULSE)} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile body (< md): matchup on top, moneyline row below. */}
      <div className="flex flex-col gap-3 px-3 pb-3 pt-2.5 md:hidden">
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className={cx("size-7 shrink-0 rounded-full", PULSE)} />
              <div className={cx("h-4 flex-1 rounded", PULSE)} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={cx("h-[38px] rounded-[9px]", PULSE)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Default groupBy is "stage": the World Cup group stage is 12 groups (A–L) of
// 4 teams = 6 matches each. The skeleton mirrors a *group section* (sticky
// header + 6 match cards) so above-the-fold card positions line up exactly
// with the loaded list. We only render a couple of sections — enough to fill
// one screen plus a little — instead of all 72 cards; the rest of the list
// just grows in below the fold when data hydrates (no visible shift).
const WC_MATCHES_PER_GROUP = 6;
const SKELETON_SECTION_COUNT = 1;

/** Games tab: desktop live-widget rail + toolbar + grouped match card list. */
export function GamesSkeleton() {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
      {/* Desktop-only right rail (mobile shows the widget inline per card). */}
      <aside className="hidden shrink-0 lg:order-last lg:block lg:w-82">
        <div className={cx("h-[400px]", PULSE, CARD)} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* Toolbar: groupBy toggle + odds-format select (real height 30px). */}
        <div className="flex items-center justify-between gap-2">
          <div className={cx("h-[30px] w-40 rounded-[10px]", PULSE)} />
          <div className={cx("h-[30px] w-24 rounded-[10px]", PULSE)} />
        </div>
        {Array.from({ length: SKELETON_SECTION_COUNT }).map((_, s) => (
          <section key={s} className="flex flex-col gap-2">
            {/* Group header: mirrors the real sticky header box (py-1.5 + a
                text-xs label = 28px) so card positions line up exactly. */}
            <div className="-mx-1 px-1 py-1.5">
              <div className={cx("h-4 w-16 rounded", PULSE)} />
            </div>
            {Array.from({ length: WC_MATCHES_PER_GROUP }).map((_, i) => (
              <MatchCardSkeleton key={i} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Props tab: responsive grid of event cards. */
export function PropsSkeleton() {
  return (
    <div className="-mx-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className={cx("h-[180px]", PULSE, CARD)} />
      ))}
    </div>
  );
}

function GroupTableSkeleton() {
  return (
    <div className={cx(CARD, "p-3")}>
      <div className="mb-2 flex items-center justify-between">
        <div className={cx("h-4 w-16 rounded", PULSE)} />
        <div className={cx("h-3 w-12 rounded", PULSE)} />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cx("h-6 rounded", PULSE)} />
        ))}
      </div>
    </div>
  );
}

/** Groups tab: 12 group tables + the best-third ranking card. */
export function GroupsSkeleton() {
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <GroupTableSkeleton key={i} />
        ))}
      </div>
      <BestThirdsSkeleton />
    </div>
  );
}

/** Best-third ranking card placeholder (also used standalone in BestThirds). */
export function BestThirdsSkeleton() {
  return (
    <div className={cx("mt-3 p-3", CARD)}>
      <div className="mb-2 flex items-center justify-between">
        <div className={cx("h-4 w-40 rounded", PULSE)} />
        <div className={cx("h-3 w-16 rounded", PULSE)} />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={cx("h-6 rounded", PULSE)} />
        ))}
      </div>
    </div>
  );
}

// Mirrors BracketMatchNode's box model exactly so the skeleton node height
// matches the real node by construction (measured 119px), not a guessed value:
//   p-2.5(20) + inner[slot 20 + gap 6 + vs-row 15 + gap 6 + slot 20 = 67]
//   + mt-2(8) + footer[border 1 + pt-1.5 6 + content 15 = 22] + border 2 = 119.
// The vs-row and footer rows are fixed at the real text-[10px] line box (15px)
// with thin pulse bars centered inside, so heights are exact but still light.
function BracketNodeSkeleton() {
  return (
    <div className="rounded-[10px] border border-zinc-800 bg-zinc-900/50 p-2.5">
      <div className="flex flex-col gap-1.5">
        <div className={cx("h-5 w-9 rounded", PULSE)} />
        <div className="flex h-[15px] items-center">
          <div className={cx("h-2.5 w-6 rounded", PULSE)} />
        </div>
        <div className={cx("h-5 w-9 rounded", PULSE)} />
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-zinc-800/60 pt-1.5">
        <div className="flex h-[15px] items-center">
          <div className={cx("h-2.5 w-16 rounded", PULSE)} />
        </div>
        <div className="flex h-[15px] items-center">
          <div className={cx("h-2.5 w-10 rounded", PULSE)} />
        </div>
      </div>
    </div>
  );
}

/** Bracket tab: round columns (>=lg) / segmented list (<lg). */
export function BracketSkeleton() {
  // r32..final node counts — must match the real per-round counts so the
  // skeleton height tracks the loaded bracket (no layout shift on hydrate).
  const columns = [16, 8, 4, 2, 1, 1];
  // Mobile defaults to the first round (r32 → 16 matches), like BracketTab.
  const mobileCount = columns[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="hidden gap-4 overflow-x-auto pb-2 lg:flex">
        {columns.map((count, ci) => (
          <div key={ci} className="flex w-[180px] shrink-0 flex-col gap-2">
            <div className={cx("mx-auto h-4 w-20 rounded", PULSE)} />
            <div className="flex flex-1 flex-col justify-around gap-2">
              {Array.from({ length: count }).map((_, i) => (
                <BracketNodeSkeleton key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 lg:hidden">
        <div className="-mx-3 flex gap-1 overflow-x-auto px-3 no-scrollbar">
          {Array.from({ length: columns.length }).map((_, i) => (
            <div key={i} className={cx("h-7 w-16 shrink-0 rounded-[8px]", PULSE)} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: mobileCount }).map((_, i) => (
            <BracketNodeSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Tab content skeleton. The sticky sub-tab row is rendered by the persistent
 * `(list)` layout, so this only covers the tab-specific content below it.
 */
export function WorldCupTabSkeleton({ tab }: { tab: WcTab }) {
  return (
    <>
      {tab === "today" && <GamesSkeleton />}
      {tab === "games" && <GamesSkeleton />}
      {tab === "props" && <PropsSkeleton />}
      {tab === "groups" && <GroupsSkeleton />}
      {tab === "bracket" && <BracketSkeleton />}
    </>
  );
}

function DetailHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cx("size-10 shrink-0 rounded-lg", PULSE)} />
          <div className={cx("size-10 shrink-0 rounded-lg", PULSE)} />
          <div className="min-w-0 flex-1 pt-1">
            <div className={cx("h-5 w-[min(72vw,420px)] rounded", PULSE)} />
            <div className="mt-2 flex items-center gap-1.5">
              <div className={cx("h-3 w-12 rounded", PULSE)} />
              <div className={cx("h-3 w-16 rounded", PULSE)} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 lg:justify-end">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-start gap-1 lg:items-end">
              <div className={cx("h-2.5 w-14 rounded", PULSE)} />
              <div className={cx("h-3 w-12 rounded", PULSE)} />
            </div>
          ))}
          <div className={cx("h-7 w-16 rounded-lg", PULSE)} />
        </div>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className={cx("min-h-[320px] flex-1 p-3", CARD)}>
      <div className="mb-4 flex items-center justify-between">
        <div className={cx("h-4 w-32 rounded", PULSE)} />
        <div className={cx("h-7 w-24 rounded-lg", PULSE)} />
      </div>
      <div className="flex h-[248px] items-end gap-2">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className={cx("flex-1 rounded-t", PULSE)}
            style={{ height: `${36 + ((i * 17) % 58)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function MatchCenterSkeleton() {
  return (
    <div className={cx("flex min-h-[320px] flex-col gap-3 p-3", CARD)}>
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cx("h-7 w-20 rounded-lg", PULSE)} />
        ))}
      </div>
      <div className={cx("h-32 rounded-[10px]", PULSE)} />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cx("h-8 rounded", PULSE)} />
        ))}
      </div>
    </div>
  );
}

function MarketsSkeleton() {
  return (
    <div className={cx("flex h-full flex-col p-3", CARD)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className={cx("h-4 w-24 rounded", PULSE)} />
        <div className={cx("h-7 w-20 rounded-lg", PULSE)} />
      </div>
      <div className="mb-3 flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cx("h-7 flex-1 rounded-lg", PULSE)} />
        ))}
      </div>
      <div className="mb-3 flex gap-1 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cx("h-7 w-20 shrink-0 rounded-lg", PULSE)} />
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={cx("h-24 rounded-[10px]", PULSE)} />
        ))}
      </div>
    </div>
  );
}

function TradeSkeleton() {
  return (
    <div className={cx("p-3", CARD)}>
      <div className="mb-3 flex gap-2">
        <div className={cx("h-9 flex-1 rounded-lg", PULSE)} />
        <div className={cx("h-9 flex-1 rounded-lg", PULSE)} />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className={cx("mb-1.5 h-3 w-16 rounded", PULSE)} />
            <div className={cx("h-10 rounded-lg", PULSE)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderbookSkeleton() {
  return (
    <div className={cx("min-h-[360px] p-3", CARD)}>
      <div className="mb-3 flex items-center justify-between">
        <div className={cx("h-4 w-24 rounded", PULSE)} />
        <div className={cx("h-7 w-20 rounded-lg", PULSE)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className={cx("h-6 rounded", PULSE)} />
        ))}
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className={cx("p-3", CARD)}>
      <div className="mb-3 flex gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={cx("h-8 w-24 rounded-lg", PULSE)} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cx("h-9 rounded", PULSE)} />
        ))}
      </div>
    </div>
  );
}

/** World Cup match detail shell: header, chart, match center, trade and orderbook. */
export function WorldCupDetailSkeleton() {
  return (
    <div className="w-full pb-4 lg:pb-16">
      <div className="w-full px-3 pt-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <DetailHeaderSkeleton />
            <div className="flex min-w-0 flex-col gap-4 xl:h-[560px] xl:flex-row xl:items-stretch">
              <div className="flex min-w-0 flex-1 flex-col gap-4 lg:h-[560px] xl:h-auto">
                <div className={cx("h-20 rounded-[12px]", PULSE)} />
                <ChartSkeleton />
              </div>
              <div className="hidden h-full w-[420px] shrink-0 min-[1800px]:block">
                <MatchCenterSkeleton />
              </div>
              <div className="h-[520px] w-full shrink-0 xl:h-full xl:w-[400px] 2xl:w-[420px]">
                <MarketsSkeleton />
              </div>
            </div>
            <div className="min-[1800px]:hidden">
              <MatchCenterSkeleton />
            </div>
            <ActivitySkeleton />
          </div>
          <aside className="hidden w-full shrink-0 flex-col gap-4 lg:sticky lg:top-2 lg:flex lg:w-[340px] xl:w-[360px]">
            <TradeSkeleton />
            <OrderbookSkeleton />
          </aside>
        </div>
      </div>
    </div>
  );
}
