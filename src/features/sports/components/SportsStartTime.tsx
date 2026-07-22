"use client";

import { useEffect, useState } from "react";

interface SportsStartTimeProps {
  value: string;
  className?: string;
  timeOnly?: boolean;
}

/** Renders deterministic UTC text until the browser can format local time. */
export function SportsStartTime({
  value,
  className,
  timeOnly = false,
}: SportsStartTimeProps) {
  const [isMounted, setIsMounted] = useState(false);
  const date = new Date(value);
  const label = isMounted
    ? timeOnly
      ? date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : date.toLocaleString()
    : timeOnly
      ? formatUtcTime(date)
      : formatUtcDateTime(date);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <time className={className} dateTime={value}>
      {label}
    </time>
  );
}

function formatUtcTime(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toISOString().slice(11, 16)} UTC`;
}

function formatUtcDateTime(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
