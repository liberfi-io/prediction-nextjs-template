"use client";

import { useMemo } from "react";
import { getGroups } from "../../data";
import { GroupTable } from "./GroupTable";
import { BestThirds } from "./BestThirds";

export function GroupsTab() {
  const groups = useMemo(() => getGroups(), []);
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
