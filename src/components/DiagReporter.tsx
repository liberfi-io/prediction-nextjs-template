"use client";

import { useEffect } from "react";
import {
  diagEnabled,
  diagMark,
  diagReport,
} from "../features/diagnostics/clientDiag";

/**
 * Headless load-diagnostics reporter, mounted once in AppLayout so it survives
 * the `/` → `/world-cup` redirect. Renders no UI; it just silently reports
 * timing snapshots to the server log (`/api/diag`) at a few fixed points so a
 * slow Telegram Mini App load can be traced from the logs alone. On by default
 * (disable with `?diag=0`).
 */
export function DiagReporter() {
  useEffect(() => {
    if (!diagEnabled()) return;
    diagMark("app_mounted");

    const onLoad = () => {
      diagMark("window_load");
      diagReport("load");
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    const timers = [
      setTimeout(() => diagReport("t3s"), 3000),
      setTimeout(() => diagReport("t8s"), 8000),
      setTimeout(() => diagReport("t20s"), 20000),
    ];

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}
