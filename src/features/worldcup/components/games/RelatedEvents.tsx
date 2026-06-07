"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Avatar, ChevronRightIcon } from "@liberfi.io/ui";
import { formatAmountInUsd } from "@liberfi.io/utils";
import { useWorldcupCurated } from "../../data/queries";
import { TEAMS } from "../../data/teams";
import type { WcProp } from "../../types";
import { useTranslation } from "@liberfi.io/i18n";

// Mirrors the event-detail "similar events" card borders (see ui-predict
// event-similar-events.ui), minus the source badge — all worldcup events are
// Polymarket, so the provider label is noise here.
const REST_BORDER = "rgba(39,39,42,0.6)";
const HOVER_BORDER = "rgba(63,63,70,0.8)";

interface RelatedItem {
  slug: string;
  title: string;
  imageUrl: string;
  volume: number;
}

/** Reduce a curated {@link WcProp} to the fields the card renders. */
function toItem(prop: WcProp, isEn: boolean): RelatedItem {
  const teamCode = prop.outcomes.find((o) => o.teamCode)?.teamCode;
  const flag = teamCode ? TEAMS[teamCode.toUpperCase()]?.flag : undefined;
  return {
    slug: prop.slug,
    title: isEn ? prop.title : prop.titleTrans || prop.title,
    imageUrl: flag ? encodeURI(flag) : "/worldcup/fifa.webp",
    volume: prop.volume,
  };
}

function RelatedEventCard({
  item,
  volumeLabel,
  onClick,
  onHover,
}: {
  item: RelatedItem;
  volumeLabel: string;
  onClick: (slug: string) => void;
  onHover: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.slug)}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = HOVER_BORDER;
        onHover(item.slug);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = REST_BORDER;
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 14,
        border: `1px solid ${REST_BORDER}`,
        background: "rgba(24,24,27,0.4)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "border-color 0.2s",
      }}
      className="group"
    >
      <Avatar
        src={item.imageUrl || undefined}
        name={item.title?.[0] || "?"}
        radius="full"
        className="size-9 shrink-0 bg-transparent"
        imgProps={{ className: "object-cover" }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          flex: 1,
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#f4f4f5",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.title}
        </span>

        <span style={{ fontSize: 10, color: "#a1a1aa" }}>
          {formatAmountInUsd(item.volume)} {volumeLabel}
        </span>
      </div>

      <ChevronRightIcon
        width={14}
        height={14}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "#71717a" }}
      />
    </button>
  );
}

/**
 * Related-events rail for the Games tab. Renders curated bracket events (World
 * Cup winner / advancement futures) with the event-detail similar-events card
 * styling. SSR-prefetched then polled every 30s; renders nothing until data is
 * present, like the detail page's similar-events section.
 *
 * `className` lets callers toggle visibility per breakpoint (desktop renders it
 * below the widget, mobile below the match list).
 */
export function RelatedEvents({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isEn = (i18n.language || "en").toLowerCase().startsWith("en");
  const { data: curated = [] } = useWorldcupCurated("bracket");

  const items = useMemo(
    () => curated.map((p) => toItem(p, isEn)),
    [curated, isEn],
  );

  if (items.length === 0) return null;

  const volumeLabel = t("extend.worldcup.volume");
  const open = (slug: string) =>
    window.open(`/polymarket/${slug}`, "_blank", "noopener,noreferrer");
  const prefetch = (slug: string) => router.prefetch(`/polymarket/${slug}`);

  return (
    <div
      className={`flex-col gap-y-3 mt-6 px-1 lg:mt-0 lg:px-0${className ? ` ${className}` : ""}`}
    >
      {/* Desktop only: header sticks just below the pinned widget (top-100 =
          400px = the widget's h-100). On mobile (<lg) it stays in flow. */}
      <div className="-mx-1 px-1 py-1.5 lg:sticky lg:top-0 lg:z-10 lg:bg-[#0a0a0b]">
        <span style={{ color: "#f4f4f5", fontSize: 14, fontWeight: 600 }}>
          {t("extend.worldcup.relatedEvents")}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {items.map((item) => (
          <RelatedEventCard
            key={item.slug}
            item={item}
            volumeLabel={volumeLabel}
            onClick={open}
            onHover={prefetch}
          />
        ))}
      </div>
    </div>
  );
}
