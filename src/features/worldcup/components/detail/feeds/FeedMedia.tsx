"use client";

import { cn } from "@liberfi.io/ui";
import type { WcFeedMedia } from "../../../types";

/**
 * Image / video grid for a feed item, mirroring the ui-media-track layout:
 * videos render first (inline players), then images in a responsive grid.
 */
export function FeedMedia({
  medias,
  className,
}: {
  medias: WcFeedMedia[];
  className?: string;
}) {
  if (!medias || medias.length === 0) return null;

  const videos = medias.filter((m) => m.type === "video");
  const images = medias.filter((m) => m.type === "image");

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {videos.map((m, i) => (
        <video
          key={`v-${i}-${m.url}`}
          src={m.url}
          poster={m.thumbnail}
          controls
          preload="none"
          className="aspect-video w-full rounded-lg bg-black object-cover"
        >
          <track
            kind="captions"
            src="data:text/vtt;charset=utf-8,WEBVTT"
            srcLang="en"
            label="Captions"
          />
        </video>
      ))}

      {images.length > 0 && (
        <div
          className={cn(
            "grid gap-1.5",
            images.length === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {images.map((m, i) => (
            <img
              key={`i-${i}-${m.url}`}
              src={m.url}
              alt=""
              loading="lazy"
              className={cn(
                "w-full rounded-lg object-cover",
                images.length === 1 ? "max-h-80" : "aspect-square",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
