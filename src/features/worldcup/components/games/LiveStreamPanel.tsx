"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import type { WcMatch, WcMatchLiveVideo, WcTeam } from "../../types";
import { TeamFlag } from "../TeamFlag";

const STREAM_MOUNT_LEAD_MS = 5 * 60 * 1000;
const ONE_SECOND_MS = 1000;
const IFRAME_LOAD_TIMEOUT_MS = 12_000;

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

/**
 * Defer mounting the player until its container has been in (or near) the
 * viewport and the browser is idle. The embedded HLS iframe pulls a video
 * segment stream as soon as it mounts, so gating it keeps that bandwidth from
 * competing with the initial list render even when a widget auto-opens.
 */
function useDeferredPlayback(): {
  ref: React.RefObject<HTMLDivElement>;
  ready: boolean;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || ready) return;

    let idleId: number | undefined;
    const start = () => setReady(true);
    const scheduleStart = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(start, { timeout: 1500 });
      } else {
        idleId = window.setTimeout(start, 300);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          scheduleStart();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (idleId == null) return;
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [ready]);

  return { ref, ready };
}

export function hasLiveVideos(
  videos?: WcMatchLiveVideo[] | null,
  match?: Pick<WcMatch, "status" | "liveState"> | null,
): boolean {
  if (match?.status === "final" || match?.liveState?.ended) return false;
  if (match?.liveState && match.liveState.live === false && match.status !== "scheduled") {
    return false;
  }
  return Boolean(videos?.some((video) => video.url && video.status === 1));
}

/**
 * Live video panel backed by the worldcup `live_videos` aggregation. Each source
 * switches the embedded player iframe and remounts it by URL.
 */
export function LiveStreamPanel({
  videos,
  kickoffMs,
  match,
  className,
  iframeClassName,
}: {
  videos?: WcMatchLiveVideo[] | null;
  kickoffMs?: number;
  match?: WcMatch | null;
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
  const [iframeState, setIframeState] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const iframeLoadTimeoutRef = useRef<number | null>(null);
  const { ref: playerRef, ready } = useDeferredPlayback();
  const { canMount, countdown } = useStreamMountGate(kickoffMs);
  const current = sources[active];
  const hasPlayableSource = hasLiveVideos(videos, match);

  useEffect(() => {
    if (active >= sources.length) setActive(0);
  }, [active, sources.length]);

  useEffect(() => {
    if (iframeLoadTimeoutRef.current !== null) {
      window.clearTimeout(iframeLoadTimeoutRef.current);
      iframeLoadTimeoutRef.current = null;
    }

    if (!current?.url || !canMount || !ready || !hasPlayableSource) {
      setIframeState("loading");
      return;
    }

    setIframeState("loading");
    iframeLoadTimeoutRef.current = window.setTimeout(() => {
      setIframeState("failed");
      iframeLoadTimeoutRef.current = null;
    }, IFRAME_LOAD_TIMEOUT_MS);

    return () => {
      if (iframeLoadTimeoutRef.current !== null) {
        window.clearTimeout(iframeLoadTimeoutRef.current);
        iframeLoadTimeoutRef.current = null;
      }
    };
  }, [canMount, current?.url, hasPlayableSource, ready]);

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      {hasPlayableSource && sources.length > 1 && (
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

      <div
        ref={playerRef}
        className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0a0b]"
      >
        {!hasPlayableSource || !current || iframeState === "failed" ? (
          <LiveUnavailable message={t("extend.worldcup.liveUnavailable")} />
        ) : canMount && ready ? (
          <iframe
            key={current.url}
            src={current.url}
            title={t("extend.worldcup.live")}
            className={cn("h-full w-full border-0 bg-[#0a0a0b]", iframeClassName)}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="no-referrer"
            onLoad={() => {
              if (iframeLoadTimeoutRef.current !== null) {
                window.clearTimeout(iframeLoadTimeoutRef.current);
                iframeLoadTimeoutRef.current = null;
              }
              setIframeState("ready");
            }}
            onError={() => {
              if (iframeLoadTimeoutRef.current !== null) {
                window.clearTimeout(iframeLoadTimeoutRef.current);
                iframeLoadTimeoutRef.current = null;
              }
              setIframeState("failed");
            }}
          />
        ) : !canMount ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-4 text-center">
            {match && (
              <div className="grid w-full max-w-[280px] grid-cols-[1fr_auto_1fr] items-center gap-3">
                <CountdownTeam team={match.home} />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {t("extend.worldcup.versus")}
                </span>
                <CountdownTeam team={match.away} />
              </div>
            )}
            <span className="text-sm font-medium text-zinc-300">
              {t("extend.worldcup.liveCountdown", { time: countdown })}
            </span>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-[#c7ff2e]" />
          </div>
        )}
      </div>
    </div>
  );
}

function LiveUnavailable({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center px-4 text-center">
      <span className="text-sm font-medium text-zinc-500">{message}</span>
    </div>
  );
}

function CountdownTeam({ team }: { team: WcTeam }) {
  const { t: _t } = useTranslation();
  const t = _t as (key: string) => string;
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <TeamFlag team={team} size={36} />
      <span className="max-w-full truncate text-xs font-semibold text-zinc-100">
        {t("extend.worldcup.teamName." + team.code.toLowerCase())}
      </span>
    </div>
  );
}
