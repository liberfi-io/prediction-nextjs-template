"use client";

import NumberFlow from "@number-flow/react";
import { useEffect, useRef, useState } from "react";
import {
  FADE_IN,
  FADE_MIN_OPACITY,
  FADE_OUT,
  NUMBERFLOW_OPACITY_TIMING,
  NUMBERFLOW_TRANSFORM_TIMING,
  prefersReducedMotion,
} from "./odds-animation";

/** A value is "rollable" by NumberFlow only when it is a finite single number. */
function asRollableNumber(value: string | number): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (trimmed === "" || /[/%¢]/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function FadeOddsNumber({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;

    const el = ref.current;
    if (!el || prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    let cancelled = false;
    const out = el.animate(
      [{ opacity: 1 }, { opacity: FADE_MIN_OPACITY }],
      FADE_OUT,
    );
    out.finished
      .then(() => {
        if (cancelled) return;
        setDisplay(value);
        el.animate([{ opacity: FADE_MIN_OPACITY }, { opacity: 1 }], FADE_IN);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <span ref={ref} className={className} style={{ opacity: 1 }}>
      {display}
    </span>
  );
}

function RollOddsNumber({
  value,
  prefix,
  suffix,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <NumberFlow
      value={value}
      prefix={prefix}
      suffix={suffix}
      className={className}
      willChange
      transformTiming={NUMBERFLOW_TRANSFORM_TIMING}
      opacityTiming={NUMBERFLOW_OPACITY_TIMING}
      respectMotionPreference
    />
  );
}

export type OddsNumberVariant = "auto" | "fade" | "roll";

/**
 * Drop-in odds-number renderer that matches Polymarket's animation behaviour.
 *
 * @param value   Already-formatted odds value from `convertPrice` (string or number).
 * @param variant "auto" rolls numeric values and fades fraction/string values;
 *                "fade" forces opacity fade (moneyline); "roll" forces NumberFlow.
 */
export function OddsNumber({
  value,
  variant = "auto",
  className = "tabular-nums",
}: {
  value: string | number;
  variant?: OddsNumberVariant;
  className?: string;
}) {
  const numeric = asRollableNumber(value);
  const useRoll = variant === "roll" || (variant === "auto" && numeric !== null);

  if (useRoll && numeric !== null) {
    return <RollOddsNumber value={numeric} className={className} />;
  }
  return <FadeOddsNumber value={String(value)} className={className} />;
}
