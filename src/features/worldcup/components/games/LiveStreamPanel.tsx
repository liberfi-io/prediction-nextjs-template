"use client";

import { useState } from "react";
import { cn } from "@liberfi.io/ui";

/**
 * Hard-coded proof-of-concept live-stream sources for the Mexico vs South Africa
 * opener, scraped from maybee.ai's `/maybee/worldcup/live-video` endpoint.
 *
 * Each "source" is one signed line of the same underlying stream
 * (`pul-tenm.nbs3g.com/live/hd-en-1-4459820`); they are wrapped in maybee's
 * third-party player shell (`veo66.bbvplayline1a.com/video.html?url=...`), which
 * loads DPlayer + hls.js and picks HLS/FLV by the URL suffix.
 *
 * NOTE: the `txSecret`/`txTime` signatures are time-limited and WILL expire.
 * This is a concept-only hard-coded list; a real integration must fetch fresh
 * URLs from the API per match.
 */
const LIVE_SOURCES: { label: string; src: string }[] = [
  {
    label: "源1",
    src: "https://veo66.bbvplayline1a.com/video.html?url=https://pul-tenm.nbs3g.com/live/hd-en-1-4459820.m3u8?txSecret=028edc523ae59fc3b7981e38be536ac1&txTime=6A2C1339",
  },
  {
    label: "源2",
    src: "https://veo66.bbvplayline1a.com/video.html?url=https://pul-tenm.nbs3g.com/live/hd-en-1-4459820.m3u8?txSecret=534cddb3a411798882371ebf5f3c8749&txTime=6A2C1A41",
  },
  {
    label: "源3",
    src: "https://veo66.bbvplayline1a.com/video.html?url=https://pul-tenm.nbs3g.com/live/hd-en-1-4459820.m3u8?txSecret=837cfde3667b458fbf8fa1a34f26b8d5&txTime=6A2C2149",
  },
  {
    label: "源4",
    src: "https://veo66.bbvplayline1a.com/video.html?url=https://pul-tenm.nbs3g.com/live/hd-en-1-4459820.m3u8?txSecret=c40048840bb59ee680b718944035cf25&txTime=6A2C2851",
  },
  {
    label: "源5",
    src: "https://veo66.bbvplayline1a.com/video.html?url=https://pul-tenm.nbs3g.com/live/hd-en-1-4459820.m3u8?txSecret=764eba4bdd3d4700f10061c0409b74f0&txTime=6A2C2F5A",
  },
  {
    label: "源6",
    src: "https://veo66.bbvplayline1a.com/video.html?url=https://pul-tenm.nbs3g.com/live/hd-en-1-4459820.m3u8?txSecret=4981a16b4c33c8909fc45f9c22816617&txTime=6A2C3661",
  },
  {
    label: "源7",
    src: "https://veo66.bbvplayline1a.com/video.html?url=https://pul-tenm.nbs3g.com/live/hd-en-1-4459820.m3u8?txSecret=410019f5acf7327e6c0bef092117abc4&txTime=6A2C3D6A",
  },
  {
    label: "源8",
    src: "https://veo66.bbvplayline1a.com/video.html?url=https://pul-tenm.nbs3g.com/live/hd-en-1-4459820.m3u8?txSecret=6625c7b980c242b046c7438e48e05417&txTime=6A2C4471",
  },
  {
    label: "源9",
    src: "https://veo66.bbvplayline1a.com/video.html?url=https://pul-tenm.nbs3g.com/live/hd-en-1-4459820.m3u8?txSecret=417e17cb6a5de35a0aa3f4e1d6e7536f&txTime=6A2C4B7B",
  },
];

/**
 * Concept-only live-stream panel: a row of source-switch buttons over an
 * embedded player iframe. Switching sources swaps the iframe `src`; the iframe
 * is keyed by `src` so it remounts cleanly on each switch.
 */
export function LiveStreamPanel({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const current = LIVE_SOURCES[active];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap gap-1.5">
        {LIVE_SOURCES.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
              i === active
                ? "border-[#c7ff2e]/50 bg-[#c7ff2e]/15 text-[#c7ff2e]"
                : "border-zinc-700/60 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
        <iframe
          key={current.src}
          src={current.src}
          title="墨西哥 vs 南非"
          className="aspect-video w-full"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="no-referrer"
        />
      </div>

      <p className="text-[11px] text-zinc-500">直播畫面由第三方數據源提供</p>
    </div>
  );
}
