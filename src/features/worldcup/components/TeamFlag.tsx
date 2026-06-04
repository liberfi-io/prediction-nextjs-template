"use client";

import { cn } from "@liberfi.io/ui";
import type { WcTeam } from "../types";

/**
 * Round team flag. Flag URLs contain spaces / unicode so we encode the src.
 * Falls back to a colour chip with the team code when no flag is available.
 */
export function TeamFlag({
  team,
  size = 24,
  className,
}: {
  team: WcTeam;
  size?: number;
  className?: string;
}) {
  if (!team.flag) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full text-[9px] font-bold text-white shrink-0",
          className,
        )}
        style={{ width: size, height: size, background: team.color }}
      >
        {team.code.slice(0, 3)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={encodeURI(team.flag)}
      alt={team.name}
      width={size}
      height={size}
      loading="lazy"
      className={cn(
        "rounded-full object-cover shrink-0 ring-1 ring-white/10",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
