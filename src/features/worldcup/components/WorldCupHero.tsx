"use client";

import { useTranslation } from "@liberfi.io/i18n";
import { useEffect, useState } from "react";

/**
 * Hero banner replicated from future.news World Cup page.
 * Background + trophy artwork live in /public/worldcup, the bottom strip is a
 * proportional tournament timeline whose green fill advances with real time
 * (0% before kickoff, matching the source).
 */

type Align = "start" | "center" | "end";

interface Milestone {
  /** i18n key under `worldcup.milestone.` */
  key: string;
  date: string; // DD/MM as shown on the banner
  iso: string; // resolved date used to compute timeline progress
  align: Align;
}

// Ordered milestones with the exact flex weights used by future.news.
const MILESTONES: Milestone[] = [
  { key: "groupStage", date: "12/06", iso: "2026-06-12", align: "start" },
  { key: "r32", date: "29/06", iso: "2026-06-29", align: "center" },
  { key: "r16", date: "05/07", iso: "2026-07-05", align: "center" },
  { key: "r8", date: "10/07", iso: "2026-07-10", align: "center" },
  { key: "r4", date: "15/07", iso: "2026-07-15", align: "center" },
  { key: "r3rd", date: "19/07", iso: "2026-07-19", align: "center" },
  { key: "final", date: "20/07", iso: "2026-07-20", align: "end" },
];

// Segment between milestone i and i+1. `flex` mirrors the source weights;
// the last segment uses a fixed 80px width.
const SEGMENTS = [
  { flex: 45.8943 },
  { flex: 16.3105 },
  { flex: 13.3858 },
  { flex: 13.9483 },
  { flex: 10.4612 },
  { width: 80 },
] as const;

function dotLabelAlign(align: Align): string {
  if (align === "start") return "items-start";
  if (align === "end") return "items-end";
  return "items-center";
}

function spanAlign(align: Align): string {
  if (align === "start") return "self-start";
  if (align === "end") return "self-end";
  return "self-center";
}

function Node({
  milestone,
  side,
  label,
  hideLabelBelowMd,
}: {
  milestone: Milestone;
  side: "left" | "right";
  label: string;
  hideLabelBelowMd?: boolean;
}) {
  const isCenter = milestone.align === "center";
  return (
    <div
      className={`absolute top-[2px] -translate-y-[5px] z-10 flex flex-col ${dotLabelAlign(
        milestone.align,
      )} ${side === "left" ? "left-0" : "right-0"} ${isCenter ? "translate-x-1/2" : ""}`}
    >
      <div className="h-[8px] w-[8px] shrink-0 rounded-full border-[1.5px] border-white/70 bg-white sm:h-[10px] sm:w-[10px]" />
      <span
        className={`mt-[2px] whitespace-nowrap text-[9px] leading-none text-white sm:text-[10px] ${spanAlign(
          milestone.align,
        )} ${hideLabelBelowMd ? "hidden md:inline" : ""}`}
      >
        {label + " " + milestone.date}
      </span>
    </div>
  );
}

export function WorldCupHero() {
  const { t: _t } = useTranslation();
  const t = _t as (key: string, options?: Record<string, unknown>) => string;
  // Progress fills are computed after mount to avoid SSR hydration mismatch
  // and to match the source's 0% pre-tournament state on first paint.
  const [fills, setFills] = useState<number[]>(() => SEGMENTS.map(() => 0));

  useEffect(() => {
    const now = Date.now();
    setFills(
      SEGMENTS.map((_, i) => {
        const start = new Date(MILESTONES[i].iso).getTime();
        const end = new Date(MILESTONES[i + 1].iso).getTime();
        if (now <= start) return 0;
        if (now >= end) return 100;
        return ((now - start) / (end - start)) * 100;
      }),
    );
  }, []);

  return (
    <div className="relative h-[136px] w-full overflow-hidden px-4 sm:h-[154px] sm:px-6">
        <img
          alt=""
          aria-hidden
          src="/worldcup/fifa-bg.webp"
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
        <img
          alt="FIFA World Cup"
          src="/worldcup/fifa.webp"
          className="absolute left-1/2 top-3 z-10 h-[78px] w-[51px] -translate-x-1/2 sm:top-4 sm:h-[100px] sm:w-[66px]"
        />

        <div className="relative flex h-[36px] items-center justify-between gap-2 text-[15px] font-semibold leading-none tracking-tight text-white sm:h-[48px] sm:text-[24px] md:text-[32px] lg:h-[58px] lg:text-[42px]">
          <span className="whitespace-nowrap">UNITED IN SOCCER</span>
          <span className="whitespace-nowrap">FIFA WORLD CUP</span>
        </div>
        <div className="relative flex h-[30px] items-center justify-between gap-2 text-[12px] font-medium leading-none text-white sm:h-[42px] sm:text-[20px] md:text-[27px] lg:h-[50px] lg:text-[37px]">
          <span className="whitespace-nowrap">USA · CANADA · MEXICO</span>
          <span className="whitespace-nowrap">UNITED 2026</span>
        </div>

        {/* Tournament timeline */}
        <div className="absolute bottom-5 left-0 right-0 px-[17px] sm:bottom-6">
          <div className="flex items-center">
            {SEGMENTS.map((seg, i) => {
              const fixed = "width" in seg;
              return (
                <div
                  key={i}
                  className={`relative flex items-center ${fixed ? "shrink-0" : ""}`}
                  style={
                    fixed
                      ? { width: `${seg.width}px` }
                      : { flex: `${seg.flex} 1 0%` }
                  }
                >
                  {i === 0 && (
                    <Node milestone={MILESTONES[0]} side="left" label={t(`extend.worldcup.milestone.${MILESTONES[0].key}`)} />
                  )}
                  <Node
                    milestone={MILESTONES[i + 1]}
                    side="right"
                    label={t(`extend.worldcup.milestone.${MILESTONES[i + 1].key}`)}
                    hideLabelBelowMd={i + 1 !== MILESTONES.length - 1}
                  />
                  <div className="relative h-[4px] w-full rounded-full bg-white/30">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#c7ff2e] transition-[width] duration-700"
                      style={{ width: `${fills[i]}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
  );
}
