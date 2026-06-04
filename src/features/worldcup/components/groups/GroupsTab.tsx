"use client";

import { useWorldcupStandings } from "../../data/queries";
import { GroupsSkeleton } from "../skeletons";
import { GroupTable } from "./GroupTable";
import { BestThirds } from "./BestThirds";

export function GroupsTab() {
  const { data: groups = [], isPending } = useWorldcupStandings();
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
