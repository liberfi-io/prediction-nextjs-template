"use client";

import { useMemo } from "react";
import { useWorldcupStandings } from "../../data/queries";
import { GroupsSkeleton } from "../skeletons";
import { GroupTable } from "./GroupTable";
import { BestThirds } from "./BestThirds";
import { applyStandingsOverride } from "./standings-override";

export function GroupsTab() {
  const { data: rawGroups = [], isPending } = useWorldcupStandings();
  // Temporary: recompute finished groups client-side until the backend serves
  // live standings. Remove with standings-override.ts.
  const groups = useMemo(() => applyStandingsOverride(rawGroups), [rawGroups]);
  if (isPending) return <GroupsSkeleton />;
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {groups.map((g) => (
          <GroupTable key={g.code} group={g} />
        ))}
      </div>
      <BestThirds />
    </div>
  );
}
