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

/** Sub-tab row placeholder, matching {@link WorldCupPage}'s sticky nav. */
export function TabRowSkeleton() {
  return (
    <div className="sticky top-0 z-40 -mx-4 mb-4 flex items-center gap-2 border-b border-zinc-800/60 bg-[#0a0a0b]/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="-mx-1 flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cx("h-8 w-16 shrink-0 rounded-[10px]", PULSE)} />
        ))}
      </div>
    </div>
  );
}

/** Games tab: pinned live widget + toolbar + match card list. */
export function GamesSkeleton() {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
      <aside className="order-first w-full shrink-0 lg:order-last lg:w-82">
        <div className={cx("h-[400px]", PULSE, CARD)} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className={cx("h-8 w-40 rounded-[10px]", PULSE)} />
          <div className={cx("h-8 w-24 rounded-[10px]", PULSE)} />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cx("h-[76px]", PULSE, CARD)} />
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

function BracketNodeSkeleton() {
  return <div className={cx("h-[104px] rounded-[10px] border border-zinc-800 bg-zinc-900/50", "animate-pulse")} />;
}

/** Bracket tab: round columns (>=lg) / segmented list (<lg). */
export function BracketSkeleton() {
  // r32..final node counts, capped per column to keep the column compact.
  const columns = [16, 8, 4, 2, 1, 1];
  return (
    <div className="flex flex-col gap-4">
      <div className="hidden gap-4 overflow-x-auto pb-2 lg:flex">
        {columns.map((count, ci) => (
          <div key={ci} className="flex w-[180px] shrink-0 flex-col gap-2">
            <div className={cx("mx-auto h-3 w-20 rounded", PULSE)} />
            <div className="flex flex-1 flex-col justify-around gap-2">
              {Array.from({ length: Math.min(count, 6) }).map((_, i) => (
                <BracketNodeSkeleton key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 lg:hidden">
        <div className="-mx-3 flex gap-1 px-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cx("h-7 w-16 shrink-0 rounded-[8px]", PULSE)} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <BracketNodeSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Full tab skeleton (sticky tab row + tab-specific content). */
export function WorldCupTabSkeleton({ tab }: { tab: WcTab }) {
  return (
    <>
      <TabRowSkeleton />
      {tab === "games" && <GamesSkeleton />}
      {tab === "props" && <PropsSkeleton />}
      {tab === "groups" && <GroupsSkeleton />}
      {tab === "bracket" && <BracketSkeleton />}
    </>
  );
}
