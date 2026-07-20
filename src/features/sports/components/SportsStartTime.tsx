"use client";

import { useEffect, useState } from "react";

interface SportsStartTimeProps {
  value: string;
  className?: string;
}

/** Renders deterministic UTC text until the browser can format local time. */
export function SportsStartTime({ value, className }: SportsStartTimeProps) {
  const [isMounted, setIsMounted] = useState(false);
  const date = new Date(value);
  const label = isMounted ? date.toLocaleString() : formatUtcDateTime(date);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <time className={className} dateTime={value}>
      {label}
    </time>
  );
}

function formatUtcDateTime(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
