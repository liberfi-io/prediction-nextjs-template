"use client";

import { cn } from "@liberfi.io/ui";
import type { WcMatch, WcTeam } from "../../types";
import { convertPrice, formatLine, type OddsFormat } from "../../odds/convert-price";
import { OddsNumber, type OddsNumberVariant } from "../../odds/OddsNumber";
import { TeamFlag } from "../TeamFlag";
import { formatKickoff, formatVolume, teamName, useWcLocale, useWcT, type WcLocale } from "../util";

type PillColors = { bg: string; text: string; shadow: string };

// Neutral fill for non-moneyline buttons. Solid enough to read as an enabled
// control (the old translucent zinc looked disabled).
const PILL_NEUTRAL: PillColors = {
  bg: "#3f3f46",
  text: "#e4e4e7",
  shadow: "rgba(0,0,0,0.45)",
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Pick black/white text for legibility on a solid colour fill. */
function textOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0a0a0b" : "#ffffff";
}

/** Darker shade of a colour, used as the button's drop-shadow "base". */
function darken(hex: string, factor = 0.5): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

/** Solid button palette derived from a team's theme colour. */
function teamColors(hex: string): PillColors {
  return { bg: hex, text: textOn(hex), shadow: darken(hex, 0.48) };
}

/**
 * A single odds button — solid fill with an elevated drop-shadow that
 * "presses" on hover, matching the single-market buy buttons on the market
 * list. Label sits on the left, animated price on the right.
 */
function Pill({
  label,
  price,
  format,
  variant = "fade",
  colors,
  tall = false,
  grow = false,
  onClick,
}: {
  label: string;
  price: number;
  format: OddsFormat;
  variant?: OddsNumberVariant;
  colors: PillColors;
  tall?: boolean;
  /** Stretch to fill the column height (spread/total fill moneyline's height). */
  grow?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const handleEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    el.style.setProperty("--shadow-offset", "1px");
    el.style.transform = "translateY(2px)";
  };

  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    el.style.setProperty("--shadow-offset", "3px");
    el.style.transform = "translateY(0px)";
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={cn(
        "flex w-full min-w-0 items-center justify-between gap-1.5 rounded-[9px] px-2.5 cursor-pointer will-change-transform [-webkit-tap-highlight-color:transparent]",
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
      <span className="truncate text-[11px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </span>
      <span className="shrink-0 text-sm font-bold tabular-nums">
        {price > 0 ? (
          <OddsNumber value={convertPrice(price, format)} variant={variant} />
        ) : (
          "—"
        )}
      </span>
    </button>
  );
}

/**
 * Matchup grid: a 2-row [flag | name+score] grid so the home and away rows
 * align by column. The score sits inline right after the name (Polymarket
 * style), keeping the left section compact.
 */
function Matchup({
  match,
  homeScore,
  awayScore,
  locale,
  mode = "compact",
}: {
  match: WcMatch;
  homeScore: number;
  awayScore: number;
  locale: WcLocale;
  /**
   * "compact" (desktop): the full scoreline sits inline after each name to keep
   * the left column narrow. "full" (mobile): each team shows only its own
   * score in a right-aligned column.
   */
  mode?: "compact" | "full";
}) {
  if (mode === "full") {
    const row = (team: WcTeam, score: number) => (
      <>
        <TeamFlag team={team} size={28} />
        <span className="truncate text-sm font-semibold text-zinc-100">
          {teamName(team, locale)}
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-300">
          {score}
        </span>
      </>
    );
    return (
      <div className="grid min-w-0 flex-1 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-2.5">
        {row(match.home, homeScore)}
        {row(match.away, awayScore)}
      </div>
    );
  }

  const score = `${homeScore}-${awayScore}`;
  const row = (team: WcTeam) => (
    <>
      <TeamFlag team={team} size={28} />
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="truncate text-sm font-semibold text-zinc-100">
          {teamName(team, locale)}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500">{score}</span>
      </div>
    </>
  );
  return (
    <div className="grid min-w-0 flex-1 grid-cols-[28px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 self-center">
      {row(match.home)}
      {row(match.away)}
    </div>
  );
}

function HeaderMeta({ match, locale, t }: { match: WcMatch; locale: WcLocale; t: ReturnType<typeof useWcT> }) {
  let lead: React.ReactNode;
  if (match.status === "live") {
    lead = (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-[#f76816]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f76816] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#f76816]" />
        </span>
        {match.livePeriod ?? "LIVE"}
      </span>
    );
  } else if (match.status === "final") {
    lead = (
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {t("worldcup.fullTime")}
      </span>
    );
  } else {
    lead = (
      <span className="text-xs font-semibold text-zinc-200 tabular-nums">
        {formatKickoff(match.kickoffMs, locale)}
      </span>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      {lead}
      <span className="truncate text-[11px] tabular-nums text-zinc-500">
        {formatVolume(match.volume)} {t("worldcup.volume")}
      </span>
    </div>
  );
}

export function MatchCard({
  match,
  format,
  activeLive = false,
  onOpen,
  onLive,
}: {
  match: WcMatch;
  format: OddsFormat;
  activeLive?: boolean;
  onOpen: (slug: string) => void;
  onLive?: (match: WcMatch) => void;
}) {
  const locale = useWcLocale();
  const t = useWcT();
  const { moneyline: ml, spread, total } = match;
  const homeScore = match.liveScore?.home ?? 0;
  const awayScore = match.liveScore?.away ?? 0;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const homeColors = teamColors(match.home.color);
  const awayColors = teamColors(match.away.color);
  const drawLabel = t("worldcup.draw");

  const moneylineCol = (tall: boolean) => (
    <>
      <Pill label={match.home.code} price={ml.home.price} format={format} variant="fade" colors={homeColors} tall={tall} />
      <Pill label={drawLabel} price={ml.draw.price} format={format} variant="fade" colors={PILL_NEUTRAL} tall={tall} />
      <Pill label={match.away.code} price={ml.away.price} format={format} variant="fade" colors={awayColors} tall={tall} />
    </>
  );

  const spreadCol = (
    <>
      <Pill label={`${match.home.code} ${formatLine(spread.line)}`} price={spread.home.price} format={format} variant="roll" colors={PILL_NEUTRAL} grow />
      <Pill label={`${match.away.code} ${formatLine(-spread.line)}`} price={spread.away.price} format={format} variant="roll" colors={PILL_NEUTRAL} grow />
    </>
  );

  const totalCol = (
    <>
      <Pill label={`O ${total.line}`} price={total.over.price} format={format} variant="roll" colors={PILL_NEUTRAL} grow />
      <Pill label={`U ${total.line}`} price={total.under.price} format={format} variant="roll" colors={PILL_NEUTRAL} grow />
    </>
  );

  const isLive = match.status === "live";
  const liveButton = (
    <button
      type="button"
      onClick={(e) => {
        stop(e);
        onLive?.(match);
      }}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
        isLive
          ? "border-[#f76816]/50 bg-[#f76816]/15 text-[#f76816] hover:bg-[#f76816]/20"
          : activeLive
            ? "border-[#c7ff2e]/50 bg-[#c7ff2e]/15 text-[#c7ff2e]"
            : "border-zinc-700/60 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800",
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
      {t("worldcup.live")}
    </button>
  );

  const viewPill = (
    <span className="hidden shrink-0 items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-800/50 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors group-hover:bg-zinc-800 md:flex">
      <span className="tabular-nums">{match.marketCount}</span>
      {t("worldcup.matchView")}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </span>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(match.slug)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(match.slug)}
      className="group cursor-pointer overflow-hidden rounded-[14px] border border-[rgba(39,39,42,0.6)] bg-[rgba(24,24,27,0.4)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 sm:px-4">
        <HeaderMeta match={match} locale={locale} t={t} />
        <div className="flex shrink-0 items-center gap-1.5">
          {liveButton}
          {viewPill}
        </div>
      </div>

      {/* ---------- Desktop body (>= md): matchup + 3 odds columns ---------- */}
      <div className="hidden items-stretch gap-3 px-4 pb-3 pt-2.5 md:flex">
        <Matchup match={match} homeScore={homeScore} awayScore={awayScore} locale={locale} />
        <div className="flex shrink-0 items-stretch gap-2">
          <div className="flex w-[112px] flex-col gap-2">{moneylineCol(false)}</div>
          <div className="flex w-[112px] flex-col gap-2">{spreadCol}</div>
          <div className="flex w-[112px] flex-col gap-2">{totalCol}</div>
        </div>
      </div>

      {/* ---------- Mobile body (< md): matchup on top, moneyline row below ---------- */}
      <div className="flex flex-col gap-3 px-3 pb-3 pt-2.5 md:hidden">
        <Matchup match={match} homeScore={homeScore} awayScore={awayScore} locale={locale} mode="full" />
        <div className="grid grid-cols-3 gap-2">{moneylineCol(true)}</div>
      </div>
    </div>
  );
}
