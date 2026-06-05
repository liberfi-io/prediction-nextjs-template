/**
 * Neutral fallback shown during the brief client-navigation RSC fetch (this
 * route is a catch-all, so the active tab is not known here). The sub-tab nav
 * lives in the persistent `(list)` layout, so this only fills the content area.
 * Once the page shell streams in, the tab-specific skeleton from `page.tsx`'s
 * Suspense boundary takes over.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[76px] animate-pulse rounded-[12px] border border-zinc-800 bg-zinc-900/40"
        />
      ))}
    </div>
  );
}
