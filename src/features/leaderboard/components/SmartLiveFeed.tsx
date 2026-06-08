"use client";

/**
 * Smart Live Feed — placeholder for the second leaderboard sub-tab.
 *
 * The real-time smart-money trade feed is a follow-up item; this renders a
 * centred "coming soon" prompt so the sub-tab is navigable today.
 */

import { useTranslation } from "@liberfi.io/i18n";

export function SmartLiveFeed() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[calc(100dvh-180px)] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800/60 bg-zinc-900/10 py-20">
      <svg
        viewBox="0 0 24 24"
        width={40}
        height={40}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-zinc-700"
        aria-hidden
      >
        <path d="M4 11a9 9 0 0 1 9 9" />
        <path d="M4 4a16 16 0 0 1 16 16" />
        <circle cx="5" cy="19" r="1" />
      </svg>
      <span className="text-sm font-medium text-zinc-400">
        {t("extend.leaderboard.liveFeed.comingSoon")}
      </span>
      <span className="max-w-xs text-center text-xs text-zinc-600">
        {t("extend.leaderboard.liveFeed.description")}
      </span>
    </div>
  );
}
