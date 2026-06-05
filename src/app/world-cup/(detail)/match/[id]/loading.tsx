/**
 * Skeleton shown while the match detail page's RSC prefetch streams in. Mirrors
 * the two-column detail layout (header, banner, chart + match center on the
 * left; order book + trade on the right).
 */
export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="h-16 animate-pulse rounded-[12px] border border-zinc-800 bg-zinc-900/40" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="h-20 animate-pulse rounded-[12px] border border-zinc-800 bg-zinc-900/40" />
          <div className="h-[360px] animate-pulse rounded-[12px] border border-zinc-800 bg-zinc-900/40" />
          <div className="h-[460px] animate-pulse rounded-[12px] border border-zinc-800 bg-zinc-900/40" />
        </div>
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[360px]">
          <div className="h-[280px] animate-pulse rounded-[12px] border border-zinc-800 bg-zinc-900/40" />
          <div className="h-[320px] animate-pulse rounded-[12px] border border-zinc-800 bg-zinc-900/40" />
        </div>
      </div>
    </div>
  );
}
