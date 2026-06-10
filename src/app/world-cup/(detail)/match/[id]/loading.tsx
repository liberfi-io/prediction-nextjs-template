/**
 * Skeleton shown while the match detail page's RSC prefetch streams in. Mirrors
 * the desktop detail layout: a left block (header, then a center row with the
 * banner + price chart beside the match-center column, then the activity
 * section) and a right aside (trade form above the order book) that aligns with
 * the top of the left block. Degrades to a single stacked column below `lg`.
 */
const BLOCK = "animate-pulse rounded-[12px] border border-zinc-800 bg-zinc-900/40";

export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
      {/* LEFT BLOCK: header + center row + activity */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* Header: back button + content */}
        <div className="flex items-center gap-3">
          <div className={`size-10 shrink-0 ${BLOCK}`} />
          <div className={`h-16 flex-1 ${BLOCK}`} />
        </div>

        {/* Center row: (banner + chart) column beside the match-center column */}
        <div className="flex flex-col gap-4 xl:h-[560px] xl:flex-row xl:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className={`h-[104px] ${BLOCK}`} />
            <div className={`h-[320px] xl:h-auto xl:flex-1 ${BLOCK}`} />
          </div>
          <div className={`h-[360px] w-full shrink-0 xl:h-auto xl:w-[440px] ${BLOCK}`} />
        </div>

        {/* Activity */}
        <div className={`h-[300px] ${BLOCK}`} />
      </div>

      {/* ASIDE: trade form above the order book */}
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[360px]">
        <div className={`h-[420px] ${BLOCK}`} />
        <div className={`h-[360px] ${BLOCK}`} />
      </div>
    </div>
  );
}
