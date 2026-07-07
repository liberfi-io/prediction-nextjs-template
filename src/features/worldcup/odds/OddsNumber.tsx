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

/**
 * Shared viewport-visibility tracker. Switching the global odds format mutates
 * every odds number on the page at once; with ~500 of them, animating all
 * simultaneously janks badly. We animate only the numbers in (or near) the
 * viewport and swap the rest instantly — the off-screen ones aren't visible
 * anyway, and won't replay a stale animation when scrolled into view.
 *
 * One observer shared across every `OddsNumber` keeps scroll cheap, and the
 * result is written to a ref so visibility changes never trigger re-renders.
 */
const VISIBILITY_ROOT_MARGIN = "200px 0px";
let visibilityObserver: IntersectionObserver | null = null;
const visibilityCallbacks = new WeakMap<Element, (visible: boolean) => void>();

function getVisibilityObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  if (!visibilityObserver) {
    visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibilityCallbacks.get(entry.target)?.(entry.isIntersecting);
        }
      },
      { rootMargin: VISIBILITY_ROOT_MARGIN },
    );
  }
  return visibilityObserver;
}

function observeVisibility(
  el: Element | null,
  onChange: (visible: boolean) => void,
): () => void {
  const observer = el && getVisibilityObserver();
  if (!el || !observer) return () => {};
  visibilityCallbacks.set(el, onChange);
  observer.observe(el);
  return () => {
    observer.unobserve(el);
    visibilityCallbacks.delete(el);
  };
}

/** A value is "rollable" by NumberFlow only when it is a finite single number. */
function asRollableNumber(value: string | number): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (trimmed === "" || /[/%¢]/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function fractionDigits(value: string | number): number | null {
  if (typeof value === "number") return null;
  const match = value.trim().match(/^[+-]?\d+\.(\d+)$/);
  return match ? match[1].length : null;
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
  fractionDigits,
  prefix,
  suffix,
  className,
}: {
  value: number;
  fractionDigits?: number | null;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <NumberFlow
      value={value}
      prefix={prefix}
      suffix={suffix}
      format={
        fractionDigits !== null && fractionDigits !== undefined
          ? {
              minimumFractionDigits: fractionDigits,
              maximumFractionDigits: fractionDigits,
              useGrouping: false,
            }
          : undefined
      }
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
  const wrapRef = useRef<HTMLSpanElement>(null);
  // Off-screen numbers render as plain text (no animator mounted). Only numbers
  // in/near the viewport mount the heavy NumberFlow/fade animators, so a global
  // format switch only rebuilds the handful on screen instead of all ~500.
  // Defaults to false so the first paint (and SSR) is cheap plain text; the
  // observer promotes the visible ones — NumberFlow doesn't animate on mount.
  const [visible, setVisible] = useState(false);

  useEffect(() => observeVisibility(wrapRef.current, setVisible), []);

  const numeric = asRollableNumber(value);
  const useRoll = variant === "roll" || (variant === "auto" && numeric !== null);
  const decimals = fractionDigits(value);

  let inner: React.ReactNode;
  if (!visible) {
    inner = <span className={className}>{String(value)}</span>;
  } else if (useRoll && numeric !== null) {
    inner = <RollOddsNumber value={numeric} fractionDigits={decimals} className={className} />;
  } else {
    inner = <FadeOddsNumber value={String(value)} className={className} />;
  }

  return <span ref={wrapRef}>{inner}</span>;
}
