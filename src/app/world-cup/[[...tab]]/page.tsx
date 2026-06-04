import { WorldCupPage } from "src/features/worldcup/components/WorldCupPage";
import { normalizeTab } from "src/features/worldcup/tabs";

interface PageProps {
  params: Promise<{ tab?: string[] }>;
}

/**
 * World Cup catch-all route. Tabs are client-rendered from the bundled static
 * dataset, so switching is instant (no per-tab SSR refetch). `/world-cup` is
 * Games; `/world-cup/<tab>` selects props / groups / bracket / map.
 */
export default async function Page({ params }: PageProps) {
  const { tab } = await params;
  return <WorldCupPage tab={normalizeTab(tab?.[0])} />;
}
