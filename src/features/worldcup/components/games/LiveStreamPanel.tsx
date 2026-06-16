"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import type { WcMatchLiveVideo } from "../../types";

const STREAM_MOUNT_LEAD_MS = 5 * 60 * 1000;
const ONE_SECOND_MS = 1000;

function shouldMountStream(kickoffMs: number | undefined, now: number): boolean {
  if (!kickoffMs || !Number.isFinite(kickoffMs)) return true;
  return now >= kickoffMs - STREAM_MOUNT_LEAD_MS;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / ONE_SECOND_MS));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function useStreamMountGate(kickoffMs?: number): {
  canMount: boolean;
  countdown: string;
} {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (shouldMountStream(kickoffMs, now)) return;
    const timer = window.setInterval(() => setNow(Date.now()), ONE_SECOND_MS);
    return () => window.clearInterval(timer);
  }, [kickoffMs, now]);

  return {
    canMount: shouldMountStream(kickoffMs, now),
    countdown: formatCountdown((kickoffMs ?? now) - now),
  };
}

export function hasLiveVideos(videos?: WcMatchLiveVideo[] | null): boolean {
  return Boolean(videos?.some((video) => video.url && video.status === 1));
}

/**
 * Live video panel backed by the worldcup `live_videos` aggregation. Each source
 * switches the embedded player iframe and remounts it by URL.
 */
export function LiveStreamPanel({
  videos,
  kickoffMs,
  className,
  iframeClassName,
}: {
  videos?: WcMatchLiveVideo[] | null;
  kickoffMs?: number;
  className?: string;
  iframeClassName?: string;
}) {
  const { t } = useTranslation();
  const sources = useMemo(() => {
    const seen = new Set<string>();
    return (videos ?? []).filter((video) => {
      if (!video.url || video.status !== 1 || seen.has(video.url)) return false;
      seen.add(video.url);
      return true;
    });
  }, [videos]);
  const [active, setActive] = useState(0);
  const { canMount, countdown } = useStreamMountGate(kickoffMs);

  useEffect(() => {
    if (active >= sources.length) setActive(0);
  }, [active, sources.length]);

  const current = sources[active];
  if (!current) return null;

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      {sources.length > 1 && (
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {sources.map((source, i) => (
            <button
              key={`${source.type}-${source.source ?? ""}-${source.url}`}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                i === active
                  ? "border-[#c7ff2e]/50 bg-[#c7ff2e]/15 text-[#c7ff2e]"
                  : "border-zinc-700/60 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800",
              )}
            >
              {t("extend.worldcup.liveSource", { index: i + 1 })}
            </button>
          ))}
        </div>
      )}

      <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0a0b]">
        {canMount ? (
          <iframe
            key={current.url}
            src={current.url}
            title={t("extend.worldcup.live")}
            className={cn("h-full w-full border-0 bg-[#0a0a0b]", iframeClassName)}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              {t("extend.worldcup.live")}
            </span>
            <span className="text-sm font-medium text-zinc-300">
              {t("extend.worldcup.liveCountdown", { time: countdown })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
