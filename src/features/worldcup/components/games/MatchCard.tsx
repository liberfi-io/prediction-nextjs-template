"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@liberfi.io/i18n";
import { cn, useScreen } from "@liberfi.io/ui";
import { EventCommentsWidget, type TradeOutcome } from "@liberfi.io/ui-predict";
import { ENABLE_WORLD_CUP_MATCH_CENTER } from "src/libs/featureFlags";
import type {
  WcHeadToHeadMatch,
  WcLiveInfo,
  WcLiveStats,
  WcMatch,
  WcPlayerSummary,
  WcTeam,
  WcTeamSquad,
  WcTeamStatLine,
} from "../../types";
import { useWorldcupMatchLiveInfo } from "../../data/queries";
import { useWorldcupMatchStats } from "../../data/live";
import { convertPrice, formatLine, type OddsFormat } from "../../odds/convert-price";
import { OddsNumber, type OddsNumberVariant } from "../../odds/OddsNumber";
import { TeamFlag } from "../TeamFlag";
import { formatLivePeriodLabel } from "../livePeriod";
import { formatKickoff, formatVolume } from "../util";
import { SportsWidget } from "./SportsWidget";
import { hasLiveVideos, LiveStreamPanel } from "./LiveStreamPanel";
import { MarketNewsWidget } from "../detail/feeds/MarketNewsWidget";
import { displayableBuyPrice } from "../../odds/displayable-price";
import {
  TEAM_BUTTON_NEUTRAL,
  teamButtonColors,
  type TeamButtonColors,
} from "../../odds/team-button-colors";

type PillColors = TeamButtonColors;
type CardPanelTab = "live" | "center" | "overview" | "stats" | "lineup" | "news" | "comments";
type WorldCupTranslate = (key: `extend.${string}`, options?: Record<string, unknown>) => string;

// Neutral fill for non-moneyline buttons. Solid enough to read as an enabled
// control (the old translucent zinc looked disabled).
const PILL_NEUTRAL = TEAM_BUTTON_NEUTRAL;

function teamColors(hex: string): PillColors {
  return teamButtonColors(hex) ?? PILL_NEUTRAL;
}

function teamName(t: WorldCupTranslate, team: WcTeam): string {
  return t(`extend.worldcup.teamName.${team.code.toLowerCase()}`);
}

function teamNameByCode(t: WorldCupTranslate, match: WcMatch, code?: string): string {
  const upper = code?.toUpperCase();
  if (!upper) return "-";
  if (upper === match.home.code) return teamName(t, match.home);
  if (upper === match.away.code) return teamName(t, match.away);
  return t(`extend.worldcup.teamName.${upper.toLowerCase()}`);
}

function teamByCode(match: WcMatch, code?: string): WcTeam | null {
  const upper = code?.toUpperCase();
  if (upper === match.home.code) return match.home;
  if (upper === match.away.code) return match.away;
  return null;
}

/**
 * A single odds button — solid fill with an elevated drop-shadow that
 * "presses" on hover, matching the single-market buy buttons on the market
 * list. Label sits on the left, animated price on the right.
 */
function Pill({
  label,
  labelSuffix,
  price,
  format,
  variant = "fade",
  colors,
  tall = false,
  grow = false,
  disabled = false,
  onClick,
}: {
  label: string;
  labelSuffix?: string;
  price: number | null | undefined;
  format: OddsFormat;
  variant?: OddsNumberVariant;
  colors: PillColors;
  tall?: boolean;
  /** Stretch to fill the column height (spread/total fill moneyline's height). */
  grow?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const displayPrice = displayableBuyPrice(price);
  const effectiveDisabled = disabled || displayPrice === null;
  const handleEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (effectiveDisabled) return;
    const el = e.currentTarget;
    el.style.setProperty("--shadow-offset", "1px");
    el.style.transform = "translateY(2px)";
  };

  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (effectiveDisabled) return;
    const el = e.currentTarget;
    el.style.setProperty("--shadow-offset", "3px");
    el.style.transform = "translateY(0px)";
  };

  return (
    <button
      type="button"
      disabled={effectiveDisabled}
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={cn(
        "flex w-full min-w-0 items-center justify-between gap-1.5 rounded-[9px] px-2.5 will-change-transform [-webkit-tap-highlight-color:transparent]",
        effectiveDisabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
        grow ? "min-h-[34px] flex-1" : tall ? "h-[38px]" : "h-[34px]",
      )}
      style={
        {
          backgroundColor: colors.bg,
          color: colors.text,
          "--shadow-color": colors.shadow,
          "--shadow-offset": "3px",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.12), 0 var(--shadow-offset, 3px) 0 var(--shadow-color, rgba(0,0,0,0.45))",
          transition: "transform .12s, box-shadow .12s",
        } as React.CSSProperties
      }
    >
      <span className="flex min-w-0 items-baseline gap-1 text-[11px] font-semibold uppercase tracking-wide opacity-75">
        <span className="min-w-0 truncate">{label}</span>
        {labelSuffix ? (
          <span className="shrink-0 tabular-nums">{labelSuffix}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-sm font-bold tabular-nums">
        {displayPrice !== null ? (
          <OddsNumber value={convertPrice(displayPrice, format)} variant={variant} />
        ) : (
          "-"
        )}
      </span>
    </button>
  );
}

/**
 * Matchup grid: a 2-row [flag | name+score] grid so each team's own score sits
 * close to the team identity. The full scoreline belongs in the header/detail
 * surfaces, not repeated beside each team name.
 */
function Matchup({
  match,
  homeScore,
  awayScore,
  mode = "compact",
}: {
  match: WcMatch;
  homeScore: number;
  awayScore: number;
  /**
   * "compact" (desktop) and "full" (mobile) share the same score placement;
   * mobile uses slightly roomier vertical spacing.
   */
  mode?: "compact" | "full";
}) {
  const { t: _t } = useTranslation();
  const t = _t as WorldCupTranslate;
  const showScore = (match.status === "live" || match.status === "final") && Boolean(match.liveScore);
  if (mode === "full") {
    const teamBlock = (team: WcTeam, side: "home" | "away") => (
      <div
        className={cn(
          "flex min-w-0 items-center gap-2",
          side === "away" && "justify-end",
        )}
      >
        {side === "home" && <TeamFlag team={team} size={28} />}
        <span className="truncate text-sm font-semibold text-zinc-100">
          {teamName(t, team)}
        </span>
        {side === "away" && <TeamFlag team={team} size={28} />}
      </div>
    );

    return (
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        {teamBlock(match.home, "home")}
        <div className="flex min-w-[52px] justify-center">
          <span className="text-sm font-black tabular-nums text-zinc-100">
            {showScore ? `${homeScore}-${awayScore}` : "vs"}
          </span>
        </div>
        {teamBlock(match.away, "away")}
      </div>
    );
  }

  const row = (team: WcTeam, score: number) => (
    <>
      <TeamFlag team={team} size={28} />
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-sm font-semibold text-zinc-100">
          {teamName(t, team)}
        </span>
        {showScore && (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-300">
            {score}
          </span>
        )}
      </div>
    </>
  );
  return (
    <div
      className={cn(
        "grid min-w-0 flex-1 grid-cols-[28px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 self-center",
      )}
    >
      {row(match.home, homeScore)}
      {row(match.away, awayScore)}
    </div>
  );
}

function HeaderMeta({ match }: { match: WcMatch }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "en";
  const kickoff = formatKickoff(match.kickoffMs, lang);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-xs font-semibold text-zinc-200 tabular-nums">
        {kickoff}
      </span>
      <span className="truncate text-[11px] tabular-nums text-zinc-500">
        {formatVolume(match.volume)} {t("extend.worldcup.volume")}
      </span>
    </div>
  );
}

function hasStatData(stats?: WcLiveStats): boolean {
  return Boolean(
    stats?.stats?.some((line) =>
      [
        line.possessionPct,
        line.shotsTotal,
        line.shotsOnTarget,
        line.corners,
        line.offsides,
        line.fouls,
        line.yellowCards,
        line.redCards,
        line.passesTotal,
        line.passesAccurate,
        line.saves,
      ].some((value) => typeof value === "number"),
    ),
  );
}

function InfoIcon({ type }: { type: "venue" | "capacity" | "city" | "referee" | "weather" | "temperature" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (type === "venue") {
    return (
      <svg {...common}>
        <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }
  if (type === "capacity") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
        <circle cx="12" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M19 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (type === "city") {
    return (
      <svg {...common}>
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
        <path d="M9 9h1" />
        <path d="M9 13h1" />
        <path d="M9 17h1" />
      </svg>
    );
  }
  if (type === "referee") {
    return (
      <svg {...common}>
        <circle cx="12" cy="7" r="4" />
        <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
      </svg>
    );
  }
  if (type === "weather") {
    return (
      <svg {...common}>
        <path d="M12 2v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="M20 12h2" />
        <path d="m19.07 4.93-1.41 1.41" />
        <path d="M15.5 13.5A4.5 4.5 0 0 0 7 15" />
        <path d="M5 19h11a3 3 0 0 0 0-6h-.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0Z" />
      <path d="M12 6v8" />
    </svg>
  );
}

function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-[10px] bg-zinc-800/50" />
      ))}
    </div>
  );
}

function PanelEmpty({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-[10px] border border-zinc-800 bg-zinc-950/30 text-sm text-zinc-500">
      {message}
    </div>
  );
}

export function OverviewPanel({
  info,
  loading,
  t,
}: {
  info?: WcLiveInfo;
  loading: boolean;
  t: WorldCupTranslate;
}) {
  if (loading) return <PanelSkeleton rows={6} />;
  const overview = info?.overview;
  const items = [
    {
      key: "venue",
      icon: "venue" as const,
      label: t("extend.worldcup.detail.liveInfo.overview.venue"),
      value: overview?.stadiumName,
    },
    {
      key: "capacity",
      icon: "capacity" as const,
      label: t("extend.worldcup.detail.liveInfo.overview.capacity"),
      value: overview?.stadiumCapacity?.toLocaleString(),
    },
    {
      key: "city",
      icon: "city" as const,
      label: t("extend.worldcup.detail.liveInfo.overview.city"),
      value: overview?.city,
    },
    {
      key: "referee",
      icon: "referee" as const,
      label: t("extend.worldcup.detail.liveInfo.overview.referee"),
      value: overview?.referee,
    },
    {
      key: "weather",
      icon: "weather" as const,
      label: t("extend.worldcup.detail.liveInfo.overview.weather"),
      value: overview?.weatherLabel,
    },
    {
      key: "temperature",
      icon: "temperature" as const,
      label: t("extend.worldcup.detail.liveInfo.overview.temperature"),
      value: undefined,
    },
  ];
  if (!items.some((item) => item.value)) {
    return <PanelEmpty message={t("extend.worldcup.detail.info.empty")} />;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex min-h-[76px] items-center gap-3 rounded-[12px] border border-zinc-800 bg-zinc-950/30 px-3"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <InfoIcon type={item.icon} />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-zinc-500">{item.label}</span>
            <span className="block truncate text-base font-semibold text-zinc-100">
              {item.value ?? "-"}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function statValue(line: WcTeamStatLine | undefined, key: keyof WcTeamStatLine): number | undefined {
  const value = line?.[key];
  return typeof value === "number" ? value : undefined;
}

function StatsBar({
  label,
  left,
  right,
  percent = false,
}: {
  label: string;
  left?: number;
  right?: number;
  percent?: boolean;
}) {
  const max = percent ? 100 : Math.max(left ?? 0, right ?? 0, 1);
  const leftWidth = `${Math.min(100, ((left ?? 0) / max) * 100)}%`;
  const rightWidth = `${Math.min(100, ((right ?? 0) / max) * 100)}%`;
  const fmt = (value?: number) => (value === undefined ? "-" : percent ? `${value}%` : String(value));
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-2 text-xs">
        <span className="font-semibold tabular-nums text-zinc-300">{fmt(left)}</span>
        <span className="text-center text-zinc-500">{label}</span>
        <span className="text-right font-semibold tabular-nums text-zinc-300">{fmt(right)}</span>
      </div>
      <div className="grid h-1.5 grid-cols-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="flex justify-end bg-zinc-800">
          <div className="h-full rounded-l-full bg-primary" style={{ width: leftWidth }} />
        </div>
        <div className="bg-zinc-800">
          <div className="h-full rounded-r-full bg-zinc-500" style={{ width: rightWidth }} />
        </div>
      </div>
    </div>
  );
}

function TechnicalStatsPanel({
  match,
  stats,
  t,
}: {
  match: WcMatch;
  stats: WcLiveStats;
  t: WorldCupTranslate;
}) {
  const home =
    stats.stats.find((line) => line.teamCode === match.home.code) ??
    stats.stats[0];
  const away =
    stats.stats.find((line) => line.teamCode === match.away.code) ??
    stats.stats[1];
  const rows: Array<{ key: keyof WcTeamStatLine; label: string; percent?: boolean }> = [
    { key: "shotsTotal", label: t("extend.worldcup.detail.liveInfo.stats.shots") },
    { key: "shotsOnTarget", label: t("extend.worldcup.detail.liveInfo.stats.shotsOnTarget") },
    { key: "possessionPct", label: t("extend.worldcup.detail.liveInfo.stats.possession"), percent: true },
    { key: "passesTotal", label: t("extend.worldcup.detail.liveInfo.stats.passes") },
    { key: "corners", label: t("extend.worldcup.detail.liveInfo.stats.corners") },
    { key: "offsides", label: t("extend.worldcup.detail.liveInfo.stats.offsides") },
    { key: "fouls", label: t("extend.worldcup.detail.liveInfo.stats.fouls") },
    { key: "yellowCards", label: t("extend.worldcup.detail.liveInfo.stats.yellowCards") },
    { key: "redCards", label: t("extend.worldcup.detail.liveInfo.stats.redCards") },
    { key: "saves", label: t("extend.worldcup.detail.liveInfo.stats.saves") },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-sm font-semibold text-zinc-100">
        <div className="flex min-w-0 items-center gap-2">
          <TeamFlag team={match.home} size={22} />
          <span className="truncate">{teamName(t, match.home)}</span>
        </div>
        <span className="text-xs font-medium text-zinc-500">
          {t("extend.worldcup.detail.liveInfo.stats.title")}
        </span>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate">{teamName(t, match.away)}</span>
          <TeamFlag team={match.away} size={22} />
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <StatsBar
            key={row.key}
            label={row.label}
            left={statValue(home, row.key)}
            right={statValue(away, row.key)}
            percent={row.percent}
          />
        ))}
      </div>
    </div>
  );
}

function resultTone(result?: string): string {
  const normalized = result?.toUpperCase();
  if (normalized === "W") return "bg-emerald-500/15 text-emerald-300";
  if (normalized === "L") return "bg-red-500/15 text-red-300";
  return "bg-zinc-800 text-zinc-300";
}

function resultSelectedTone(result?: string): string {
  const normalized = result?.toUpperCase();
  if (normalized === "W") return "ring-emerald-400/70";
  if (normalized === "L") return "ring-red-400/70";
  return "ring-zinc-500/70";
}

function TeamFormBlock({
  match,
  form,
  t,
}: {
  match: WcMatch;
  form: WcLiveInfo["teamForm"][number];
  t: WorldCupTranslate;
}) {
  const team = teamByCode(match, form.teamCode);
  const visibleMatches = form.matches.slice(0, 5);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = visibleMatches[selectedIndex] ?? visibleMatches[0];
  return (
    <div className="space-y-3 rounded-[12px] border border-zinc-800 bg-zinc-950/30 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
        {team ? <TeamFlag team={team} size={24} /> : null}
        <span>{teamNameByCode(t, match, form.teamCode)}</span>
      </div>
      <div className="flex gap-1.5">
        {visibleMatches.map((item, i) => (
          <button
            key={`${item.date ?? ""}-${i}`}
            type="button"
            onClick={() => setSelectedIndex(i)}
            className={cn(
              "flex h-9 w-9 cursor-pointer items-center justify-center rounded-[8px] text-sm font-bold transition-colors",
              resultTone(item.result),
              selectedIndex === i &&
                cn("ring-1 ring-offset-1 ring-offset-zinc-950", resultSelectedTone(item.result)),
            )}
          >
            {item.result ?? "-"}
          </button>
        ))}
      </div>
      {selected && (
        <div className="text-xs text-zinc-500">
          {[
            selected.score,
            selected.opponentCode
              ? `${t("extend.worldcup.versus")} ${teamNameByCode(t, match, selected.opponentCode)}`
              : null,
            selected.homeAway,
            selected.date,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}
    </div>
  );
}

function HeadToHeadRow({
  item,
  match,
  t,
}: {
  item: WcHeadToHeadMatch;
  match: WcMatch;
  t: WorldCupTranslate;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[8px] bg-zinc-900/50 px-3 py-2 text-xs">
      <span className="truncate text-zinc-300">{teamNameByCode(t, match, item.homeCode)}</span>
      <span className="font-semibold tabular-nums text-zinc-100">
        {item.homeScore ?? "-"} - {item.awayScore ?? "-"}
      </span>
      <span className="truncate text-right text-zinc-300">
        {teamNameByCode(t, match, item.awayCode)}
      </span>
    </div>
  );
}

function FormAndHistoryPanel({
  info,
  match,
  t,
}: {
  info?: WcLiveInfo;
  match: WcMatch;
  t: WorldCupTranslate;
}) {
  const forms = info?.teamForm ?? [];
  const h2h = info?.headToHead;
  if (forms.length === 0 && !h2h?.matches?.length) {
    return <PanelEmpty message={t("extend.worldcup.detail.info.empty")} />;
  }
  return (
    <div className="space-y-4">
      {forms.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-zinc-300">
              {t("extend.worldcup.detail.liveInfo.form.title")}
            </h4>
            <span className="text-xs text-zinc-500">
              {t("extend.worldcup.detail.liveInfo.form.latestFirst")}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {forms.map((form) => (
              <TeamFormBlock key={form.teamCode} match={match} form={form} t={t} />
            ))}
          </div>
        </section>
      )}
      {h2h?.matches?.length ? (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-zinc-300">
            {t("extend.worldcup.detail.liveInfo.h2h.title")}
          </h4>
          <div className="grid gap-1.5">
            {h2h.matches.slice(0, 5).map((item, i) => (
              <HeadToHeadRow key={`${item.date ?? ""}-${i}`} item={item} match={match} t={t} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function StatsPanel({
  info,
  loading,
  match,
  realtimeStats,
  t,
}: {
  info?: WcLiveInfo;
  loading: boolean;
  match: WcMatch;
  realtimeStats?: WcLiveStats;
  t: WorldCupTranslate;
}) {
  if (loading) return <PanelSkeleton rows={8} />;
  const stats = realtimeStats ?? info?.liveStats;
  if (hasStatData(stats)) {
    return <TechnicalStatsPanel match={match} stats={stats!} t={t} />;
  }
  return <FormAndHistoryPanel info={info} match={match} t={t} />;
}

function PlayerRow({ player }: { player: WcPlayerSummary }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      {player.number !== undefined ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-800 px-1 text-xs font-semibold text-zinc-400">
          {player.number}
        </span>
      ) : (
        <span className="h-5 min-w-5 rounded-full border border-secondary/70" />
      )}
      <span className="min-w-0 flex-1 truncate text-zinc-200">{player.name}</span>
      {player.position ? (
        <span className="shrink-0 text-xs text-zinc-500">{player.position}</span>
      ) : null}
    </div>
  );
}

function SquadHeader({
  squad,
  match,
  t,
}: {
  squad: WcTeamSquad;
  match: WcMatch;
  t: WorldCupTranslate;
}) {
  const team = teamByCode(match, squad.teamCode);
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-100">
        {team ? <TeamFlag team={team} size={24} /> : null}
        <span className="truncate">{teamNameByCode(t, match, squad.teamCode)}</span>
      </div>
      {squad.formation ? (
        <span className="rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 text-xs font-semibold text-secondary">
          {squad.formation}
        </span>
      ) : null}
    </div>
  );
}

function CorePlayersPanel({
  squads,
  match,
  t,
}: {
  squads: WcTeamSquad[];
  match: WcMatch;
  t: WorldCupTranslate;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center text-sm text-zinc-500">
        {t("extend.worldcup.detail.liveInfo.lineup.pending")}
      </div>
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-300">
          {t("extend.worldcup.detail.liveInfo.lineup.corePlayers")}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          {squads.map((squad) => (
            <div key={squad.teamCode} className="space-y-3">
              <SquadHeader squad={squad} match={match} t={t} />
              <div className="space-y-2">
                {squad.corePlayers.slice(0, 6).map((player, i) => (
                  <PlayerRow key={`${player.playerId ?? player.name}-${i}`} player={player} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FullLineupPanel({
  squads,
  match,
  t,
}: {
  squads: WcTeamSquad[];
  match: WcMatch;
  t: WorldCupTranslate;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {squads.map((squad) => (
        <div key={squad.teamCode} className="space-y-3 sm:border-r sm:border-zinc-800 sm:pr-4 sm:last:border-r-0 sm:last:pr-0">
          <SquadHeader squad={squad} match={match} t={t} />
          <div className="space-y-2">
            {(squad.starters ?? []).map((player, i) => (
              <PlayerRow key={`${player.playerId ?? player.name}-${i}`} player={player} />
            ))}
          </div>
          {(squad.substitutes?.length ?? 0) > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-xs font-semibold text-zinc-500">
                {t("extend.worldcup.detail.liveInfo.lineup.substitutes")}
              </div>
              {squad.substitutes!.map((player, i) => (
                <PlayerRow key={`${player.playerId ?? player.name}-${i}`} player={player} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function LineupPanel({
  info,
  loading,
  match,
  t,
}: {
  info?: WcLiveInfo;
  loading: boolean;
  match: WcMatch;
  t: WorldCupTranslate;
}) {
  if (loading) return <PanelSkeleton rows={7} />;
  const squads = info?.squads ?? [];
  if (!squads.some((squad) => squad.corePlayers.length || squad.starters?.length)) {
    return <PanelEmpty message={t("extend.worldcup.detail.info.empty")} />;
  }
  const hasStarters = squads.some((squad) => (squad.starters?.length ?? 0) > 0);
  return hasStarters ? (
    <FullLineupPanel squads={squads} match={match} t={t} />
  ) : (
    <CorePlayersPanel squads={squads} match={match} t={t} />
  );
}

function MatchCardImpl({
  match,
  format,
  activeLive = false,
  highlighted = false,
  widgetOpen = false,
  onOpen,
  onMarketPick,
  onPrefetch,
  onLive,
  onToggleWidget,
}: {
  match: WcMatch;
  format: OddsFormat;
  /** This match is the current live-widget selection. */
  activeLive?: boolean;
  /** URL deep-link target highlight. */
  highlighted?: boolean;
  /** Mobile: this card's inline live widget is expanded. */
  widgetOpen?: boolean;
  onOpen: (slug: string) => void;
  onMarketPick?: (match: WcMatch, marketCode: string, outcome: TradeOutcome) => void;
  /** Warm the full match event ahead of a trade/detail interaction. */
  onPrefetch?: (slug: string) => void;
  /** Desktop: select this match for the pinned right-rail widget. */
  onLive?: (match: WcMatch) => void;
  /** Mobile: toggle this card's inline live widget. */
  onToggleWidget?: (match: WcMatch) => void;
}) {
  const { t } = useTranslation();
  const { isDesktop } = useScreen();
  const translate = t as (key: `extend.${string}`) => string;
  const { moneyline: ml, spread, total } = match;
  const homeScore = match.liveScore?.home ?? 0;
  const awayScore = match.liveScore?.away ?? 0;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const pickMarket = (
    e: React.MouseEvent,
    marketCode: string,
    outcome: TradeOutcome,
    price: number,
  ) => {
    stop(e);
    if (price <= 0) return;
    onMarketPick?.(match, marketCode, outcome);
  };
  const marketsDisabled = match.status === "final" || Boolean(match.liveState?.ended);
  const hasLive = hasLiveVideos(match.liveVideos, match);
  const [panelTab, setPanelTab] = useState<CardPanelTab>(
    hasLive ? "live" : "overview",
  );
  const wasWidgetOpenRef = useRef(false);

  const homeColors = teamColors(match.home.color);
  const awayColors = teamColors(match.away.color);
  const drawLabel = translate("extend.worldcup.draw");
  const homeLabel = teamName(translate, match.home);
  const awayLabel = teamName(translate, match.away);
  const overLabel = translate("extend.worldcup.totalSide.over");
  const underLabel = translate("extend.worldcup.totalSide.under");

  const moneylineCol = (tall: boolean) => (
    <>
      <Pill
        label={homeLabel}
        price={ml.home.price}
        format={format}
        variant="fade"
        colors={homeColors}
        tall={tall}
        disabled={marketsDisabled}
        onClick={(e) => pickMarket(e, "mlh", "yes", ml.home.price)}
      />
      <Pill
        label={drawLabel}
        price={ml.draw.price}
        format={format}
        variant="fade"
        colors={PILL_NEUTRAL}
        tall={tall}
        disabled={marketsDisabled}
        onClick={(e) => pickMarket(e, "mld", "yes", ml.draw.price)}
      />
      <Pill
        label={awayLabel}
        price={ml.away.price}
        format={format}
        variant="fade"
        colors={awayColors}
        tall={tall}
        disabled={marketsDisabled}
        onClick={(e) => pickMarket(e, "mla", "yes", ml.away.price)}
      />
    </>
  );

  const homeSpreadMarketCode = spread.line < 0 ? "sph" : "spa";
  const awaySpreadMarketCode = spread.line < 0 ? "sph" : "spa";
  const homeSpreadOutcome: TradeOutcome = spread.line < 0 ? "yes" : "no";
  const awaySpreadOutcome: TradeOutcome = spread.line < 0 ? "no" : "yes";
  const totalMarketCode = total.line > 0 ? `to${Math.round(total.line * 10)}` : "to";

  const spreadCol = (
    <>
      <Pill
        label={homeLabel}
        labelSuffix={formatLine(spread.line)}
        price={spread.home.price}
        format={format}
        variant="roll"
        colors={PILL_NEUTRAL}
        grow
        disabled={marketsDisabled}
        onClick={(e) =>
          pickMarket(e, homeSpreadMarketCode, homeSpreadOutcome, spread.home.price)
        }
      />
      <Pill
        label={awayLabel}
        labelSuffix={formatLine(-spread.line)}
        price={spread.away.price}
        format={format}
        variant="roll"
        colors={PILL_NEUTRAL}
        grow
        disabled={marketsDisabled}
        onClick={(e) =>
          pickMarket(e, awaySpreadMarketCode, awaySpreadOutcome, spread.away.price)
        }
      />
    </>
  );

  const totalCol = (
    <>
      <Pill
        label={`${overLabel} ${total.line}`}
        price={total.over.price}
        format={format}
        variant="roll"
        colors={PILL_NEUTRAL}
        grow
        disabled={marketsDisabled}
        onClick={(e) => pickMarket(e, totalMarketCode, "yes", total.over.price)}
      />
      <Pill
        label={`${underLabel} ${total.line}`}
        price={total.under.price}
        format={format}
        variant="roll"
        colors={PILL_NEUTRAL}
        grow
        disabled={marketsDisabled}
        onClick={(e) => pickMarket(e, totalMarketCode, "no", total.under.price)}
      />
    </>
  );

  const isLive = match.status === "live";
  const liveButtonLabel =
    match.status === "live"
      ? formatLivePeriodLabel(match, translate) ?? t("extend.worldcup.live")
      : match.status === "final"
        ? t("extend.worldcup.fullTime")
        : t("extend.worldcup.live");
  const renderLiveButton = (opts: {
    highlighted: boolean;
    onClick: () => void;
    className: string;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        stop(e);
        opts.onClick();
      }}
      className={cn(
        "shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
        isLive
          ? "border-[#f76816]/50 bg-[#f76816]/15 text-[#f76816] hover:bg-[#f76816]/20"
          : match.status === "final"
            ? "border-bearish/40 bg-bearish/10 text-bearish hover:bg-bearish/15"
          : opts.highlighted
            ? "border-[#c7ff2e]/50 bg-[#c7ff2e]/15 text-[#c7ff2e]"
            : "border-zinc-700/60 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800",
        opts.className,
      )}
    >
      {isLive ? (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f76816] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#f76816]" />
        </span>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
      {liveButtonLabel}
    </button>
  );

  const viewPill = (
    <span className="hidden shrink-0 items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-800/50 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors group-hover:bg-zinc-800 md:flex">
      <span className="tabular-nums">{match.marketCount}</span>
      {t("extend.worldcup.matchView")}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </span>
  );

  const desktopTabs = useMemo<CardPanelTab[]>(
    () => {
      const centerTabs: CardPanelTab[] = ENABLE_WORLD_CUP_MATCH_CENTER
        ? ["center", "news", "comments"]
        : ["news", "comments"];
      const infoTabs: CardPanelTab[] = ["overview", "stats", "lineup"];
      return hasLive ? ["live", ...infoTabs, ...centerTabs] : [...infoTabs, ...centerTabs];
    },
    [hasLive],
  );
  const mobileTabs = useMemo<CardPanelTab[]>(
    () => {
      const centerTabs: CardPanelTab[] = ENABLE_WORLD_CUP_MATCH_CENTER
        ? ["center", "news", "comments"]
        : ["news", "comments"];
      const infoTabs: CardPanelTab[] = ["overview", "stats", "lineup"];
      return hasLive ? ["live", ...infoTabs, ...centerTabs] : [...infoTabs, ...centerTabs];
    },
    [hasLive],
  );
  const panelTabs = isDesktop ? desktopTabs : mobileTabs;

  useEffect(() => {
    if (widgetOpen && !wasWidgetOpenRef.current) {
      setPanelTab(
        hasLive ? "live" : "overview",
      );
    }
    wasWidgetOpenRef.current = widgetOpen;
  }, [hasLive, widgetOpen]);

  useEffect(() => {
    if (!panelTabs.includes(panelTab)) setPanelTab(panelTabs[0]);
  }, [panelTab, panelTabs]);

  const renderPanelTabButton = (tab: CardPanelTab, keyPrefix: string, className: string) => (
    <button
      key={`${keyPrefix}-${tab}`}
      type="button"
      onClick={() => setPanelTab(tab)}
      className={cn(
        "rounded-[8px] px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
        panelTab === tab
          ? "bg-zinc-800 text-[#c7ff2e]"
          : "text-zinc-500 hover:text-zinc-200",
        className,
      )}
    >
      {tab === "live"
        ? t("extend.worldcup.live")
        : t(`extend.worldcup.detail.tab.${tab}`)}
    </button>
  );

  const effectivePanelTab: CardPanelTab = panelTabs.includes(panelTab)
    ? panelTab
    : panelTabs[0];
  const liveInfoEnabled =
    widgetOpen &&
    (effectivePanelTab === "overview" ||
      effectivePanelTab === "stats" ||
      effectivePanelTab === "lineup");
  const { data: liveInfo, isLoading: isLiveInfoLoading } =
    useWorldcupMatchLiveInfo(match.matchId, { enabled: liveInfoEnabled });
  const realtimeStats = useWorldcupMatchStats(
    widgetOpen && effectivePanelTab === "stats" && match.status === "live"
      ? match.matchId
      : undefined,
  );

  const panelContent = (() => {
    switch (effectivePanelTab) {
      case "live":
        return (
          <LiveStreamPanel
            videos={match.liveVideos}
            kickoffMs={match.kickoffMs}
            match={match}
          />
        );
      case "center":
        return <SportsWidget match={match} className={isDesktop ? "h-170" : "h-136"} />;
      case "overview":
        return (
          <OverviewPanel
            info={liveInfo}
            loading={isLiveInfoLoading}
            t={translate}
          />
        );
      case "stats":
        return (
          <StatsPanel
            info={liveInfo}
            loading={isLiveInfoLoading}
            match={match}
            realtimeStats={realtimeStats}
            t={translate}
          />
        );
      case "lineup":
        return (
          <LineupPanel
            info={liveInfo}
            loading={isLiveInfoLoading}
            match={match}
            t={translate}
          />
        );
      case "comments":
        return (
          <EventCommentsWidget
            slug={match.slug}
            source="polymarket"
            className="h-136"
          />
        );
      case "news":
      default:
        return <MarketNewsWidget slug={match.slug} className="h-136" />;
    }
  })();

  return (
    <div
      id={`match-${match.matchId}`}
      data-match-id={match.matchId}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(match.slug)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(match.slug)}
      onPointerEnter={() => onPrefetch?.(match.slug)}
      onPointerDown={() => onPrefetch?.(match.slug)}
      className={cn(
        "group cursor-pointer overflow-hidden rounded-[14px] border bg-[rgba(24,24,27,0.4)] transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_140px] hover:border-[rgba(63,63,70,0.8)]",
        highlighted
          ? "border-[#c7ff2e]/70 shadow-[0_0_0_1px_rgba(199,255,46,0.35)]"
          : "border-[rgba(39,39,42,0.6)]",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 sm:px-4">
        <HeaderMeta match={match} />
        <div className="flex shrink-0 items-center gap-1.5">
          {renderLiveButton({
            highlighted: activeLive || widgetOpen,
            onClick: () => {
              onLive?.(match);
              onToggleWidget?.(match);
            },
            className: "flex",
          })}
          {viewPill}
        </div>
      </div>

      {/* ---------- Desktop body (>= md): matchup + 3 odds columns ---------- */}
      <div className="hidden items-stretch gap-3 px-4 pb-3 pt-2.5 md:flex">
        <Matchup match={match} homeScore={homeScore} awayScore={awayScore} />
        <div className="flex shrink-0 items-stretch gap-2">
          <div className="flex w-[128px] flex-col gap-2">{moneylineCol(false)}</div>
          <div className="flex w-[128px] flex-col gap-2">{spreadCol}</div>
          <div className="flex w-[128px] flex-col gap-2">{totalCol}</div>
        </div>
      </div>

      {/* ---------- Mobile body (< md): matchup on top, moneyline row below ---------- */}
      <div className="flex flex-col gap-3 px-3 pb-3 pt-2.5 md:hidden">
        <Matchup match={match} homeScore={homeScore} awayScore={awayScore} mode="full" />
        <div className="grid grid-cols-3 gap-2">{moneylineCol(true)}</div>
      </div>

      <AnimatePresence initial={false}>
        {widgetOpen && (
          <motion.div
            key="live-widget"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
            onClick={stop}
          >
            <div className="px-3 pb-3 sm:px-4">
              <div className="rounded-[12px] border border-zinc-800 bg-zinc-900/40">
                <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {desktopTabs.map((tab) => renderPanelTabButton(tab, "desktop", "hidden lg:block"))}
                  {mobileTabs.map((tab) => renderPanelTabButton(tab, "mobile", "block lg:hidden"))}
                </div>
                <div className="p-2">{panelContent}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Memoized so the 30s matches poll only re-renders cards whose props actually
 * changed. Relies on callers passing stable callback identities (see
 * `GamesTab`); object props (`match`) are compared by reference, so an
 * unchanged match coming back from the poll must keep its identity.
 */
export const MatchCard = memo(MatchCardImpl);
