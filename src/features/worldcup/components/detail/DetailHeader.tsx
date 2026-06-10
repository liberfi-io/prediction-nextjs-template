"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PredictEvent, PredictMarket } from "@liberfi.io/react-predict";
import { cn } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import { formatVolume } from "../util";

/**
 * Detail-page header: event image + title with a "/ <selected market>" dropdown
 * that toggles the Markets panel, a Sports / Soccer breadcrumb, and the headline
 * stats (end date, liquidity, volume, open interest). Mirrors future.news.
 *
 * When `popoverContent` is provided (desktop), the Markets panel opens as a
 * popover anchored to the title instead of occupying a fixed column; it closes
 * on outside click or Escape via `onClose`.
 *
 * To the right of the stats, two info popovers mirror future.news: "Rules"
 * (the selected market's resolution description) and "Ref" (the event's
 * settlement source links + originating provider).
 */
export function DetailHeader({
  event,
  market,
  selectedLabel,
  panelOpen,
  onTogglePanel,
  popoverContent,
  onClose,
  showInfoButtons = true,
}: {
  event: PredictEvent;
  market?: PredictMarket;
  selectedLabel: string;
  panelOpen: boolean;
  onTogglePanel: () => void;
  popoverContent?: ReactNode;
  onClose?: () => void;
  /**
   * Show the Rules / Ref info popover buttons next to the stats. Desktop keeps
   * them in the header; mobile sets this `false` and surfaces the same content
   * as flat tabs instead.
   */
  showInfoButtons?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "en";

  // Close the title popover on outside click / Escape (desktop only — the
  // popover is rendered inside `anchorRef`, so clicks within it are ignored).
  const anchorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!popoverContent || !panelOpen || !onClose) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [popoverContent, panelOpen, onClose]);

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
          <div className="relative min-w-0" ref={anchorRef}>
            <button
              type="button"
              onClick={onTogglePanel}
              className="flex min-w-0 max-w-full items-center gap-1.5 text-left cursor-pointer group"
            >
              <span className="min-w-0 truncate text-base font-semibold text-zinc-100">
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

            {/* Markets popover, anchored to the title (desktop). Absolutely
                positioned (out of flow, so it never shifts sibling elements)
                with an opaque backing + high z-index so it floats cleanly over
                the chart / match center instead of bleeding through them. */}
            {popoverContent && panelOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 w-[min(90vw,360px)] rounded-[12px] bg-zinc-950 shadow-2xl shadow-black/50">
                {popoverContent}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-4 gap-y-1.5">
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1.5">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-end text-right">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                  {s.label}
                </span>
                <span className="text-xs font-semibold tabular-nums text-zinc-200">
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          {/* Rules / Ref info popovers, to the right of the stats */}
          {showInfoButtons && (
          <div className="flex items-center gap-1.5">
            <InfoPopoverButton
              label={t("extend.worldcup.detail.info.rules")}
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M8 13h8M8 17h6" />
                </svg>
              }
            >
              <RulesContent
                title={t("extend.worldcup.detail.info.rules")}
                text={market?.description || event.description || ""}
                emptyLabel={t("extend.worldcup.detail.info.empty")}
              />
            </InfoPopoverButton>

            <InfoPopoverButton
              label={t("extend.worldcup.detail.info.ref")}
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18h6M10 22h4" />
                  <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
                </svg>
              }
            >
              <RefContent
                title={t("extend.worldcup.detail.info.ref")}
                sourceLabel={t("extend.worldcup.detail.info.resolutionSource")}
                sources={event.settlement_sources ?? []}
                provider={event.source}
                emptyLabel={t("extend.worldcup.detail.info.empty")}
              />
            </InfoPopoverButton>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A small pill button that toggles an anchored popover. The popover floats
 * (absolute, out of flow) with an opaque backing + high z-index so it never
 * shifts sibling layout, and closes on outside click or Escape.
 */
function InfoPopoverButton({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 rounded-[8px] border px-2 py-1 text-xs font-medium transition-colors",
          open
            ? "border-zinc-600 bg-zinc-800 text-zinc-100"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100",
        )}
      >
        {icon}
        <span>{label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-[12px] border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50">
          {children}
        </div>
      )}
    </div>
  );
}

/** Rules popover body — the selected market's resolution description. */
export function RulesContent({
  title,
  text,
  emptyLabel,
}: {
  title: string;
  text: string;
  emptyLabel: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="px-4 pb-2 pt-3 text-sm font-semibold text-zinc-100">
        {title}
      </div>
      <div className="max-h-[60vh] overflow-y-auto px-4 pb-4 text-[13px] leading-relaxed text-zinc-400">
        {text ? (
          <p className="whitespace-pre-line">{text}</p>
        ) : (
          <p className="text-zinc-500">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}

/** Ref popover body — settlement source links + originating provider. */
export function RefContent({
  title,
  sourceLabel,
  sources,
  provider,
  emptyLabel,
}: {
  title: string;
  sourceLabel: string;
  sources: { url: string; name?: string }[];
  provider?: string;
  emptyLabel: string;
}) {
  const providerName = provider
    ? provider.charAt(0).toUpperCase() + provider.slice(1)
    : null;
  const hasSources = sources.length > 0;
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <span className="text-sm font-semibold text-zinc-100">{title}</span>
        {providerName && (
          <span className="text-xs font-medium text-sky-400">{providerName}</span>
        )}
      </div>
      <div className="px-4 pb-4">
        {hasSources ? (
          <>
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">
              {sourceLabel}
            </div>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-[13px] text-sky-400 hover:underline"
                  >
                    {s.name || s.url}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[13px] text-zinc-500">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
