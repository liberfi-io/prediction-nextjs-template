"use client";

import { useState } from "react";
import { cn } from "@liberfi.io/ui";
import { formatAge } from "@liberfi.io/utils";
import { useTranslation } from "@liberfi.io/i18n";
import type { WcFeed } from "../../../types";
import { FeedMedia } from "./FeedMedia";

const TWEET_BASE = "https://x.com";

function tweetUrl(feed: WcFeed): string | undefined {
  if (!feed.tweetId) return undefined;
  const handle = feed.user.handle ?? "i";
  return `${TWEET_BASE}/${handle}/status/${feed.tweetId}`;
}

function userUrl(feed: WcFeed): string | undefined {
  return feed.user.handle ? `${TWEET_BASE}/${feed.user.handle}` : undefined;
}

/** Relative age in seconds for {@link formatAge}. */
function ageSeconds(timestampMs: number): number {
  return Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
}

/**
 * Single feed card. Layout benchmarks the ui-media-track tweet card:
 * avatar + name + verified badge + @handle + relative time, then clamped text
 * with an expand toggle, then a media grid. A "Reposted" indicator shows for
 * retweets.
 */
export function FeedItem({ feed }: { feed: WcFeed }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const href = tweetUrl(feed);
  const profileHref = userUrl(feed);
  const isRepost = feed.type === "retweet";
  const text = feed.text?.trim() ?? "";
  const isLong = text.length > 180 || text.split("\n").length > 4;

  return (
    <article className="flex flex-col gap-2 rounded-[10px] border border-zinc-800 bg-zinc-900/40 p-3">
      {isRepost && (
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <RepostIcon className="size-3.5" />
          {t("extend.worldcup.detail.news.reposted")}
        </div>
      )}

      <header className="flex items-start gap-2.5">
        <a
          href={profileHref}
          target="_blank"
          rel="noreferrer"
          className="shrink-0"
        >
          {feed.user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={feed.user.avatar}
              alt={feed.user.name ?? feed.user.handle ?? ""}
              className="size-9 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-400">
              {(feed.user.name ?? feed.user.handle ?? "?")
                .charAt(0)
                .toUpperCase()}
            </span>
          )}
        </a>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <a
              href={profileHref}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm font-semibold text-zinc-100 hover:underline"
            >
              {feed.user.name || feed.user.handle || "—"}
            </a>
            {feed.user.verifiedType && (
              <VerifiedIcon className="size-3.5 shrink-0 text-[#1d9bf0]" />
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            {feed.user.handle && <span className="truncate">@{feed.user.handle}</span>}
            {feed.user.handle && <span aria-hidden>·</span>}
            <span className="shrink-0">{formatAge(ageSeconds(feed.timestampMs))}</span>
          </div>
        </div>
      </header>

      {text && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          <p
            className={cn(
              "whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200",
              !expanded && "line-clamp-4",
            )}
          >
            {text}
          </p>
        </a>
      )}

      {text && isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-xs font-medium text-[#c7ff2e] hover:underline cursor-pointer"
        >
          {expanded
            ? t("extend.worldcup.detail.news.showLess")
            : t("extend.worldcup.detail.news.showMore")}
        </button>
      )}

      <FeedMedia medias={feed.medias} />
    </article>
  );
}

function VerifiedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
    </svg>
  );
}

function RepostIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
