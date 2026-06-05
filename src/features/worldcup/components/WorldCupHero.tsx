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

// Segment between milestone i and i+1. Widths follow the real calendar gaps so
// the dots are spaced by actual date intervals, but we soften them with an
// exponent (<1) so the long group-stage gap doesn't dominate and the tightly
// packed knockout dots on the right get a bit more breathing room. The last
// segment keeps a fixed width to leave room for the end-aligned final label.
const RIGHT_BOOST_EXPONENT = 0.65;
const DAY_MS = 24 * 60 * 60 * 1000;

const SEGMENTS = [
  ...MILESTONES.slice(0, MILESTONES.length - 2).map((m, i) => {
    const days =
      (new Date(MILESTONES[i + 1].iso).getTime() - new Date(m.iso).getTime()) /
      DAY_MS;
    return { flex: Math.pow(days, RIGHT_BOOST_EXPONENT) };
  }),
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
  pulse,
}: {
  milestone: Milestone;
  side: "left" | "right";
  label: string;
  hideLabelBelowMd?: boolean;
  pulse?: boolean;
}) {
  const isCenter = milestone.align === "center";
  return (
    <div
      className={`absolute top-[2px] z-10 flex flex-col ${dotLabelAlign(
        milestone.align,
      )} ${side === "left" ? "left-0" : "right-0"} ${isCenter ? "translate-x-1/2" : ""}`}
    >
      <div className="relative -mt-[4px] h-[8px] w-[8px] shrink-0 sm:-mt-[5px] sm:h-[10px] sm:w-[10px]">
        {pulse && (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-white/70" />
            <span className="absolute inset-[-3px] animate-pulse rounded-full bg-white/25" />
          </>
        )}
        <span className="absolute inset-0 rounded-full border-[1.5px] border-white/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.45)]" />
      </div>
      <span
        className={`mt-[2px] whitespace-nowrap text-[9px] leading-none text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)] sm:text-[10px] ${spanAlign(
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
        <div aria-hidden className="absolute inset-0 z-0 flex items-stretch">
          <div className="h-full min-w-0 flex-[1_1_0%] bg-[#6E01F4]" />
          <img alt="" aria-hidden src="/worldcup/hero-l.webp" className="h-full w-auto shrink-0" />
          <div className="h-full min-w-0 flex-[2_1_0%] bg-[#A0ED01]" />
        </div>
        <img
          alt=""
          aria-hidden
          src="/worldcup/hero-r.webp"
          className="absolute inset-y-0 right-[10%] xl:right-[20%] z-[1] h-full w-auto"
        />
        <div aria-hidden className="absolute inset-0 z-[2] bg-black/30" />

        <div className="absolute inset-x-0 top-4 z-10 px-[17px] sm:top-6">
          <div className="mx-auto w-full max-w-330">
            <div className="flex max-w-[72%] flex-col gap-0.5 text-left font-semibold uppercase leading-tight text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)] sm:max-w-[55%]">
              <span className="whitespace-nowrap text-[20px] sm:text-[28px] md:text-[36px]">UNITED IN SOCCER</span>
              <div className="mt-1 flex items-center gap-2 sm:gap-3">
                {[
                  { src: "/worldcup/flags/usa.svg", alt: "USA" },
                  { src: "/worldcup/flags/can.svg", alt: "Canada" },
                  { src: "/worldcup/flags/mex.svg", alt: "Mexico" },
                ].map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={f.alt}
                    src={f.src}
                    alt={f.alt}
                    className="h-[23px] w-[23px] shrink-0 [filter:drop-shadow(0_1px_3px_rgb(0_0_0/0.5))] sm:h-[34px] sm:w-[34px]"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-4 right-[calc(10%+114px)] z-10 hidden flex-col gap-0.5 text-right font-semibold uppercase leading-tight text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)] sm:top-6 sm:right-[calc(10%+128px)] lg:flex xl:right-[calc(20%+128px)]">
          <span className="whitespace-nowrap text-[20px] sm:text-[28px] md:text-[36px]">FIFA WORLD CUP</span>
          <span className="whitespace-nowrap text-[13px] font-medium sm:text-[18px] md:text-[24px]">UNITED 2026</span>
        </div>
        {/* Temporarily hidden: center FIFA mark + headline copy
        <div className="relative flex h-[36px] items-center justify-between gap-2 text-[15px] font-semibold leading-none tracking-tight text-white sm:h-[48px] sm:text-[24px] md:text-[32px] lg:h-[58px] lg:text-[42px]">
          <span className="whitespace-nowrap">UNITED IN SOCCER</span>
          <span className="whitespace-nowrap">FIFA WORLD CUP</span>
        </div>
        <div className="relative flex h-[30px] items-center justify-between gap-2 text-[12px] font-medium leading-none text-white sm:h-[42px] sm:text-[20px] md:text-[27px] lg:h-[50px] lg:text-[37px]">
          <span className="whitespace-nowrap">USA · CANADA · MEXICO</span>
          <span className="whitespace-nowrap">UNITED 2026</span>
        </div>
        */}

        {/* Tournament timeline */}
        <div className="absolute bottom-5 left-0 right-0 z-10 px-[17px] sm:bottom-6">
          <div className="mx-auto flex w-full max-w-330 items-center pr-[calc(10%+96px)] xl:pr-[calc(20%+96px)]">
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
                    <Node milestone={MILESTONES[0]} side="left" label={t(`extend.worldcup.milestone.${MILESTONES[0].key}`)} pulse />
                  )}
                  {MILESTONES[i + 1].key !== "r3rd" && (
                    <Node
                      milestone={MILESTONES[i + 1]}
                      side="right"
                      label={t(`extend.worldcup.milestone.${MILESTONES[i + 1].key}`)}
                      hideLabelBelowMd={i + 1 !== MILESTONES.length - 1}
                    />
                  )}
                  <div
                    className={`relative h-[4px] w-full bg-white/35 shadow-[0_1px_2px_rgb(0_0_0/0.35)] ${
                      i === 0 ? "rounded-l-full" : ""
                    } ${i === SEGMENTS.length - 1 ? "rounded-r-full" : ""}`}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 bg-[#c7ff2e] transition-[width] duration-700 ${
                        i === 0 ? "rounded-l-full" : ""
                      } ${i === SEGMENTS.length - 1 ? "rounded-r-full" : ""}`}
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
