"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@liberfi.io/i18n";
import type { WcMatch } from "../../types";
import { TeamFlag } from "../TeamFlag";

/** Two-digit zero-padded number. */
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Countdown parts to a future timestamp; all zero once it has passed. */
function countdownTo(targetMs: number): {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  started: boolean;
} {
  const diff = targetMs - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, started: true };
  const secs = Math.floor(diff / 1000);
  return {
    days: Math.floor(secs / 86400),
    hours: Math.floor((secs % 86400) / 3600),
    mins: Math.floor((secs % 3600) / 60),
    secs: secs % 60,
    started: false,
  };
}

function CountdownCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="rounded-md bg-zinc-800 px-2 py-1 text-sm font-bold tabular-nums text-zinc-100">
        {value}
      </span>
      <span className="mt-1 text-[9px] uppercase tracking-wide text-zinc-500">
        {label}
      </span>
    </div>
  );
}

/**
 * Match banner: home team (flag + name + win probability) on the left, the
 * kickoff countdown in the centre, and the away team on the right. Probabilities
 * come from the match moneyline; the countdown ticks every second client-side.
 */
export function MatchBanner({ match }: { match: WcMatch }) {
  const { t: _t, i18n } = useTranslation();
  const t = _t as (key: string, options?: Record<string, unknown>) => string;
  const lang = i18n.language || "en";

  // Start null so SSR and the first client render agree (a live Date.now() would
  // mismatch); the real countdown begins ticking after mount.
  const [cd, setCd] = useState<ReturnType<typeof countdownTo> | null>(null);
  useEffect(() => {
    const tick = () => setCd(countdownTo(match.kickoffMs));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [match.kickoffMs]);
  const view = cd ?? { days: 0, hours: 0, mins: 0, secs: 0, started: false };

  const homeProb = Math.round(match.moneyline.home.price * 100);
  const awayProb = Math.round(match.moneyline.away.price * 100);
  const homeScore = match.liveScore?.home ?? 0;
  const awayScore = match.liveScore?.away ?? 0;
  const showScore = match.status === "live" || match.status === "final";
  const teamName = (code: string) =>
    t("extend.worldcup.teamName." + code.toLowerCase());

  const kickoff = new Date(match.kickoffMs).toLocaleString(
    lang.startsWith("zh") ? "zh-CN" : "en-US",
    { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  );

  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      {/* Home — flag / name / win rate stacked vertically */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
        <TeamFlag team={match.home} size={40} />
        <div className="w-full truncate text-sm font-semibold text-zinc-100">
          {teamName(match.home.code)}
        </div>
        <div className="text-xs font-bold tabular-nums text-[#c7ff2e]">
          {showScore ? homeScore : `${homeProb}%`}
        </div>
      </div>

      {/* Centre: countdown / live state */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        {showScore ? (
          <>
            <span className="text-2xl font-black tabular-nums text-zinc-100">
              {homeScore}-{awayScore}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-[#f76816]">
              {match.status === "final"
                ? t("extend.worldcup.fullTime")
                : match.livePeriod ?? t("extend.worldcup.live")}
            </span>
          </>
        ) : view.started ? (
          <span className="text-xs font-semibold uppercase tracking-wide text-[#f76816]">
            {t("extend.worldcup.detail.banner.started")}
          </span>
        ) : (
          <>
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">
              {t("extend.worldcup.detail.banner.beginsIn")}
            </span>
            <div className="flex items-start gap-1.5">
              <CountdownCell value={pad(view.days)} label={t("extend.worldcup.detail.banner.days")} />
              <CountdownCell value={pad(view.hours)} label={t("extend.worldcup.detail.banner.hours")} />
              <CountdownCell value={pad(view.mins)} label={t("extend.worldcup.detail.banner.mins")} />
              <CountdownCell value={pad(view.secs)} label={t("extend.worldcup.detail.banner.secs")} />
            </div>
          </>
        )}
        <span className="text-[10px] tabular-nums text-zinc-500">{kickoff}</span>
      </div>

      {/* Away — flag / name / win rate stacked vertically */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
        <TeamFlag team={match.away} size={40} />
        <div className="w-full truncate text-sm font-semibold text-zinc-100">
          {teamName(match.away.code)}
        </div>
        <div className="text-xs font-bold tabular-nums text-[#c7ff2e]">
          {showScore ? awayScore : `${awayProb}%`}
        </div>
      </div>
    </div>
  );
}
