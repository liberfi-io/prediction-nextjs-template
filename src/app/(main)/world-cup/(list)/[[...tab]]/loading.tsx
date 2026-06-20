"use client";

import { usePathname } from "next/navigation";
import { WorldCupTabSkeleton } from "src/features/worldcup/components/skeletons";
import { normalizeTab } from "src/features/worldcup/tabs";

/**
 * Fallback shown during the client-navigation RSC fetch for this segment. The
 * active tab is derived from the pathname (the sub-tab nav lives in the
 * persistent `(list)` layout, so this segment never receives route params), and
 * we render the exact same tab-specific skeleton as `page.tsx`'s Suspense
 * boundary. Keeping all three stages identical — this fallback, the streamed
 * Suspense fallback, and the loaded content — means no layout jump on load.
 */
export default function Loading() {
  const pathname = usePathname();
  const tab = normalizeTab(pathname.split("/")[2]);
  return <WorldCupTabSkeleton tab={tab} />;
}
