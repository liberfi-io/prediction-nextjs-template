"use client";

import type { PredictEvent } from "@liberfi.io/react-predict";
import { cn } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import { formatVolume } from "../util";

/**
 * Detail-page header: event image + title with a "/ <selected market>" dropdown
 * that toggles the Markets panel, a Sports / Soccer breadcrumb, and the headline
 * stats (end date, liquidity, volume, open interest). Mirrors future.news.
 */
export function DetailHeader({
  event,
  selectedLabel,
  panelOpen,
  onTogglePanel,
  onBack,
}: {
  event: PredictEvent;
  selectedLabel: string;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "en";

  const endDate = event.end_at
    ? new Date(event.end_at).toLocaleDateString(
        lang.startsWith("zh") ? "zh-CN" : "en-US",
        { year: "numeric", month: "short", day: "numeric" },
      )
    : "—";

  const stats: { label: string; value: string }[] = [
    { label: t("extend.worldcup.detail.stats.endDate"), value: endDate },
    {
      label: t("extend.worldcup.detail.stats.liquidity"),
      value: event.liquidity != null ? formatVolume(event.liquidity) : "—",
    },
    {
      label: t("extend.worldcup.detail.stats.volume"),
      value: event.volume != null ? formatVolume(event.volume) : "—",
    },
    {
      label: t("extend.worldcup.detail.stats.oi"),
      value: event.open_interest != null ? formatVolume(event.open_interest) : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200 cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        {t("extend.worldcup.detail.back")}
      </button>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {event.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.image_url}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg border border-zinc-800 object-cover"
            />
          ) : (
            <div className="h-10 w-10 shrink-0 rounded-lg border border-zinc-800 bg-zinc-900" />
          )}
          <div className="min-w-0">
            <button
              type="button"
              onClick={onTogglePanel}
              className="flex items-center gap-1.5 text-left cursor-pointer group"
            >
              <span className="truncate text-base font-semibold text-zinc-100">
                {event.title}
              </span>
              <span className="shrink-0 text-zinc-600">/</span>
              <span className="shrink-0 truncate text-base font-semibold text-[#c7ff2e]">
                {selectedLabel}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "shrink-0 text-zinc-400 transition-transform group-hover:text-zinc-200",
                  panelOpen && "rotate-180",
                )}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span>{t("extend.worldcup.detail.breadcrumb.sports")}</span>
              <span className="text-zinc-700">/</span>
              <span>{t("extend.worldcup.detail.breadcrumb.soccer")}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                {s.label}
              </span>
              <span className="text-xs font-semibold tabular-nums text-zinc-200">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
