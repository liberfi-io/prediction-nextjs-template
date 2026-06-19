"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@liberfi.io/i18n";
import { cn, useScreen } from "@liberfi.io/ui";
import { EventCommentsWidget, type TradeOutcome } from "@liberfi.io/ui-predict";
import { ENABLE_WORLD_CUP_MATCH_CENTER } from "src/libs/featureFlags";
import type { WcMatch, WcTeam } from "../../types";
import { convertPrice, formatLine, type OddsFormat } from "../../odds/convert-price";
import { OddsNumber, type OddsNumberVariant } from "../../odds/OddsNumber";
import { TeamFlag } from "../TeamFlag";
import { formatLivePeriodLabel } from "../livePeriod";
import { formatKickoff, formatVolume } from "../util";
import { SportsWidget } from "./SportsWidget";
import { hasLiveVideos, LiveStreamPanel } from "./LiveStreamPanel";
import { MarketNewsWidget } from "../detail/feeds/MarketNewsWidget";

type PillColors = { bg: string; text: string; shadow: string };
type CardPanelTab = "live" | "center" | "news" | "comments";
type WorldCupTranslate = (key: `extend.${string}`, options?: Record<string, unknown>) => string;

// Neutral fill for non-moneyline buttons. Solid enough to read as an enabled
// control (the old translucent zinc looked disabled).
const PILL_NEUTRAL: PillColors = {
  bg: "#3f3f46",
  text: "#e4e4e7",
  shadow: darken("#3f3f46", 0.48),
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

function teamName(t: WorldCupTranslate, team: WcTeam): string {
  return t(`extend.worldcup.teamName.${team.code.toLowerCase()}`);
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
  price: number;
  format: OddsFormat;
  variant?: OddsNumberVariant;
  colors: PillColors;
  tall?: boolean;
  /** Stretch to fill the column height (spread/total fill moneyline's height). */
  grow?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const handleEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const el = e.currentTarget;
    el.style.setProperty("--shadow-offset", "1px");
    el.style.transform = "translateY(2px)";
  };

  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const el = e.currentTarget;
    el.style.setProperty("--shadow-offset", "3px");
    el.style.transform = "translateY(0px)";
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={cn(
        "flex w-full min-w-0 items-center justify-between gap-1.5 rounded-[9px] px-2.5 will-change-transform [-webkit-tap-highlight-color:transparent]",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
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
    hasLive ? "live" : ENABLE_WORLD_CUP_MATCH_CENTER ? "center" : "news",
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
      return hasLive ? ["live", ...centerTabs] : centerTabs;
    },
    [hasLive],
  );
  const mobileTabs = useMemo<CardPanelTab[]>(
    () => {
      const centerTabs: CardPanelTab[] = ENABLE_WORLD_CUP_MATCH_CENTER
        ? ["center", "news", "comments"]
        : ["news", "comments"];
      return hasLive ? ["live", ...centerTabs] : centerTabs;
    },
    [hasLive],
  );
  const panelTabs = isDesktop ? desktopTabs : mobileTabs;

  useEffect(() => {
    if (widgetOpen && !wasWidgetOpenRef.current) {
      setPanelTab(
        hasLive ? "live" : ENABLE_WORLD_CUP_MATCH_CENTER ? "center" : "news",
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
