"use client";

/**
 * Portfolio hero stats (realized PnL, win rate, positions value, volume).
 * Aligned with @liberfi.io/ui-predict ProfileStats; kept locally so the template
 * builds against published SDK versions that do not export that component yet.
 */

import { useMemo } from "react";
import { useTranslation } from "@liberfi.io/i18n";
import type { PredictPosition, PredictTrade } from "@liberfi.io/react-predict";
import { cn, Skeleton } from "@liberfi.io/ui";

export interface PortfolioStatsProps {
  positions: PredictPosition[];
  trades: PredictTrade[];
  isLoading: boolean;
}

export function PortfolioStats({ positions, trades, isLoading }: PortfolioStatsProps) {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    let realizedPnl = 0;
    let positionsValue = 0;
    for (const p of positions) {
      realizedPnl += p.realized_pnl ?? 0;
      positionsValue += p.current_value ?? p.size * (p.current_price ?? 0);
    }

    let volume = 0;
    let wins = 0;
    let settled = 0;
    for (const tr of trades) {
      volume += tr.usd_size ?? 0;
      if (tr.type === "REDEEM") {
        settled++;
        if ((tr.usd_size ?? 0) > 0) wins++;
      }
    }

    const winRateStr = settled > 0 ? `${wins} / ${settled}` : "0 / 0";

    return { realizedPnl, positionsValue, volume, winRateStr };
  }, [positions, trades]);

  const pnlColor =
    stats.realizedPnl > 0
      ? "text-success"
      : stats.realizedPnl < 0
        ? "text-danger"
        : "text-foreground";
  const pnlSign = stats.realizedPnl > 0 ? "+" : "";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-6">
      <div className="flex flex-col gap-1">
        <span className="text-xl text-neutral">{t("predict.profile.realizedPnl")}</span>
        {isLoading ? (
          <Skeleton className="h-14 w-48 rounded-md" />
        ) : (
          <span className={cn("text-5xl font-bold tabular-nums", pnlColor)}>
            {pnlSign}${Math.abs(stats.realizedPnl).toFixed(2)}
          </span>
        )}
      </div>

      <div className="flex items-end gap-8 sm:gap-10">
        <StatCard
          label={t("predict.profile.winRate")}
          value={stats.winRateStr}
          isLoading={isLoading}
        />
        <StatCard
          label={t("predict.profile.positions")}
          value={`$${stats.positionsValue.toFixed(2)}`}
          isLoading={isLoading}
        />
        <StatCard
          label={t("predict.profile.volume")}
          value={`$${stats.volume.toFixed(2)}`}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: string;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-sm text-neutral whitespace-nowrap">{label}</span>
      {isLoading ? (
        <Skeleton className="h-6 w-14 rounded-md" />
      ) : (
        <span className="text-base font-semibold tabular-nums text-foreground">{value}</span>
      )}
    </div>
  );
}
