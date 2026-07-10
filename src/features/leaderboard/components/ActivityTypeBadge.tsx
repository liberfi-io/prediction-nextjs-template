"use client";

import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";

export type ActivityTypeLabelKey =
  | "extend.leaderboard.activity.buy"
  | "extend.leaderboard.activity.sell"
  | "extend.leaderboard.activity.redeem";

export function activityTypeMeta(type: string): { key: ActivityTypeLabelKey; className: string } {
  const lower = type.toLowerCase();
  if (lower === "sell") {
    return { key: "extend.leaderboard.activity.sell", className: "bg-bearish/10 text-bearish" };
  }
  if (lower === "redeem") {
    return { key: "extend.leaderboard.activity.redeem", className: "bg-primary/10 text-primary" };
  }
  return { key: "extend.leaderboard.activity.buy", className: "bg-bullish/10 text-bullish" };
}

export function ActivityTypeBadge({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const meta = activityTypeMeta(type);
  return (
    <span className={cn("rounded px-1.5 py-0.5 font-medium", meta.className, className)}>
      {t(meta.key)}
    </span>
  );
}
