"use client";

/**
 * Top-3 podium for the Smart Money leaderboard.
 *
 * A faithful port of the `top3-concentric` reference: the champion (rank 1) sits
 * centred and elevated between rank 2 (left) and rank 3 (right). Each card uses a
 * fixed height (champion tallest), a rank circle riding the top edge, a badge
 * pill, a clipped scrim/sheen overlay, and an emblem layering a spinning
 * {@link EmblemBacking} (the LiberFi brand mark) behind the shared
 * {@link GradientAvatar}. The champion rank circle carries a trophy icon ported
 * from the reference; rank 2 / 3 show their numerals. The medal palette
 * (focus → bullish, silver, bronze) matches the reference while the focus accent
 * is swapped to the app's bullish colour.
 *
 * Ring spin / glow / sheen keyframes live in `src/styles/theme.css` because the
 * shared tailwind preset does not ship the tw-animate utilities.
 */

import { cn, LogoIcon } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import { CopyButton } from "../../../components/CopyButton";
import { GradientAvatar } from "../../../components/GradientAvatar";
import { formatRate, formatSignedUsd, shortAddress } from "../format";
import type { SmartWalletEntry } from "../types";

type Rank = 1 | 2 | 3;

interface RankStyle {
  /** Accent colour for ring / badge / rank circle / champion PNL (CSS colour). */
  accent: string;
  /** Card border (matches reference per-rank borders). */
  border: string;
  /** Badge i18n key. */
  badgeKey: string;
  /** Ring opacity (reference: rank1 0.95, rank2 0.4, rank3 0.3). */
  ringOpacity: number;
}

const BULLISH = "var(--color-bullish)";
const SILVER = "#cfd2d6";
const BRONZE = "#c98a3a";

const RANK_STYLE: Record<Rank, RankStyle> = {
  1: { accent: BULLISH, border: "1.5px solid var(--color-bullish)", badgeKey: "extend.leaderboard.podium.champion", ringOpacity: 0.95 },
  2: { accent: SILVER, border: "1px solid rgba(207,210,214,0.45)", badgeKey: "extend.leaderboard.podium.second", ringOpacity: 0.4 },
  3: { accent: BRONZE, border: "1px solid rgba(201,138,58,0.5)", badgeKey: "extend.leaderboard.podium.third", ringOpacity: 0.3 },
};

/** Scrim gradient (top fade + heavy bottom) ported verbatim from the reference. */
const SCRIM =
  "linear-gradient(180deg,rgba(8,8,6,0.25) 0%,transparent 38%,transparent 62%,rgba(8,8,6,0.8) 94%)";

export function Top3Podium({
  entries,
  selectedWallet,
  onSelect,
}: {
  entries: SmartWalletEntry[];
  selectedWallet?: string;
  onSelect: (wallet: string) => void;
}) {
  const top1 = entries[0];
  const top2 = entries[1];
  const top3 = entries[2];
  if (!top1) return null;

  const selected = selectedWallet?.toLowerCase();

  return (
    <div className="flex items-end justify-center gap-3 px-2 sm:gap-4">
      {top2 && (
        <PodiumCard rank={2} entry={top2} active={selected === top2.wallet.toLowerCase()} onSelect={onSelect} />
      )}
      <PodiumCard rank={1} entry={top1} active={selected === top1.wallet.toLowerCase()} onSelect={onSelect} />
      {top3 && (
        <PodiumCard rank={3} entry={top3} active={selected === top3.wallet.toLowerCase()} onSelect={onSelect} />
      )}
    </div>
  );
}

function PodiumCard({
  rank,
  entry,
  active,
  onSelect,
}: {
  rank: Rank;
  entry: SmartWalletEntry;
  active: boolean;
  onSelect: (wallet: string) => void;
}) {
  const { t } = useTranslation();
  const style = RANK_STYLE[rank];
  const champion = rank === 1;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(entry.wallet)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(entry.wallet);
        }
      }}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group relative shrink-0 cursor-pointer outline-none",
        // Reference widths: rank1 268, rank2/3 240 — scaled down for mobile.
        champion ? "w-[180px] sm:w-[268px]" : "w-[156px] sm:w-[240px]",
      )}
    >
      {/* Rank circle riding the top edge (half pokes out → outer card is visible). */}
      <span
        className="absolute -top-3.5 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full font-mono text-sm font-semibold"
        style={
          champion
            ? { background: style.accent, color: "#000", boxShadow: "0 0 14px rgba(199,255,46,0.5)" }
            : { background: "#1a1d24", color: style.accent, border: `1.5px solid ${style.accent}` }
        }
      >
        {champion ? (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
            <path d="M18 4h2.2c.5 0 .8.4.8.8C21 8 19.6 10.6 17 11.3V12a5 5 0 0 1-4 4.9V19h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.1A5 5 0 0 1 7 12v-.7C4.4 10.6 3 8 3 4.8c0-.4.3-.8.8-.8H6V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1ZM6 6H5c.2 1.7 1 3 2.4 3.6A7 7 0 0 1 6 7.5V6Zm12 0v1.5c0 .7-.1 1.4-.4 2.1C19 9 19.8 7.7 20 6h-2Z" />
          </svg>
        ) : (
          rank
        )}
      </span>

      {/* Inner card: clips the scrim/sheen + rounded border + fixed height. */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl bg-[#080806] transition-shadow",
          champion ? "h-[256px] sm:h-[304px]" : "h-[228px] sm:h-[268px]",
          active && "ring-2 ring-bullish/40",
        )}
        style={{ border: style.border }}
      >
        {/* Champion diagonal sheen sweep */}
        {champion && (
          <div
            className="lf-sheen pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                "linear-gradient(115deg,transparent 34%,rgba(199,255,46,0.06) 48%,transparent 60%)",
            }}
          />
        )}
        {/* Scrim overlay */}
        <div className="pointer-events-none absolute inset-0 z-[2]" style={{ background: SCRIM }} />

        {/* Content */}
        <div
          className={cn(
            "relative z-[3] flex h-full flex-col items-center justify-start text-center transition-colors",
            "gap-3 px-4 pb-[18px] pt-[22px]",
            active ? "bg-white/[0.02]" : "group-hover:bg-white/[0.02]",
          )}
        >
          {/* Top: badge + emblem */}
          <div className="flex flex-col items-center gap-3">
            <span
              className="inline-flex items-center rounded-full font-mono text-[11px] font-medium uppercase tracking-wide"
              style={
                champion
                  ? { background: style.accent, color: "#000", padding: "5px 13px" }
                  : { color: style.accent, border: `1px solid ${style.accent}59`, padding: "4px 12px" }
              }
            >
              {t(style.badgeKey)}
            </span>

            <div
              className={cn(
                "relative flex items-center justify-center",
                champion ? "h-24 w-24 sm:h-[120px] sm:w-[120px]" : "h-[76px] w-[76px] sm:h-24 sm:w-24",
              )}
            >
              <EmblemBacking accent={style.accent} opacity={style.ringOpacity} spin={champion} />
              <div
                className="relative z-[2] rounded-full"
                style={{ boxShadow: champion ? undefined : `0 0 0 2px ${style.accent}` }}
              >
                <GradientAvatar
                  seed={entry.wallet}
                  size={champion ? 70 : 56}
                  className="!rounded-full"
                />
              </div>
            </div>
          </div>

          {/* Text: name + pnl + sub */}
          <div className="flex flex-col items-center gap-[7px]">
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "truncate font-mono font-medium text-white",
                  champion ? "text-[14px] sm:text-[15px]" : "text-[12px] sm:text-[13px]",
                )}
              >
                {shortAddress(entry.wallet)}
              </span>
              <CopyButton
                value={entry.wallet}
                title={t("extend.leaderboard.copy")}
                className="text-zinc-400 opacity-100 transition-opacity focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
              />
            </span>
            <span
              className={cn(
                "font-semibold tabular-nums tracking-tight",
                champion ? "text-2xl sm:text-[30px]" : "text-lg sm:text-[23px]",
              )}
              style={{ color: champion ? style.accent : "#fff" }}
            >
              {formatSignedUsd(entry.score)}
            </span>
            <span
              className="font-mono text-[11px]"
              style={{ color: champion ? "rgba(199,255,46,0.6)" : "rgba(255,255,255,0.4)" }}
            >
              {formatRate(entry.winRate)} {t("extend.leaderboard.col.winRate")} · {entry.marketCount}{" "}
              {t("extend.leaderboard.col.markets")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Emblem backing: the LiberFi brand mark sits behind the avatar as the podium
 * "logo" graphic (replacing the reference ring PNG). The champion mark slowly
 * spins and glows; rank 2 / 3 render dimmer and static. A thin accent ring keeps
 * the circular framing the reference conveyed.
 */
function EmblemBacking({
  accent,
  opacity,
  spin,
}: {
  accent: string;
  opacity: number;
  spin: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ color: accent }}>
      {/* Radial glow halo (champion only). */}
      {spin && (
        <div
          className="animate-podium-glow absolute inset-[6%] rounded-full"
          style={{ background: `radial-gradient(circle, ${accent}26 0%, transparent 70%)` }}
        />
      )}
      {/* Thin accent ring framing the emblem. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ border: `1px solid ${accent}`, opacity: opacity * 0.7 }}
      />
      {/* Brand logo as the emblem image. */}
      <div
        className={cn("absolute inset-[16%]", spin && "animate-ring-spin")}
        style={{
          opacity,
          filter: spin ? `drop-shadow(0 0 8px ${accent}66)` : undefined,
        }}
      >
        <LogoIcon className="h-full w-full" />
      </div>
    </div>
  );
}
