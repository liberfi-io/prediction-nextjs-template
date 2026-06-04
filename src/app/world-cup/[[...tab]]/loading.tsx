/**
 * Skeleton fallback for the games layout (tab row + cards). The shared hero and
 * page container come from the /world-cup layout, so this only fills children.
 */
export default function Loading() {
  return (
    <>
      <div className="mb-4 flex gap-2 border-b border-zinc-800/60 pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-16 animate-pulse rounded-[10px] bg-zinc-800/50" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[76px] animate-pulse rounded-[12px] border border-zinc-800 bg-zinc-900/40"
          />
        ))}
      </div>
    </>
  );
}
