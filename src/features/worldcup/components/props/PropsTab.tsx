"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LinkComponentType } from "@liberfi.io/ui";
import { EventsUI } from "@liberfi.io/ui-predict";
import type {
  PredictEvent,
  PredictMarket,
} from "@liberfi.io/react-predict";
import { useTranslation } from "@liberfi.io/i18n";
import { useWorldcupProps } from "../../data/queries";
import { TEAMS } from "../../data/teams";
import type { WcOutcome, WcProp } from "../../types";
import { PropsSkeleton } from "../skeletons";

const NoPrefetchLink: LinkComponentType = (props) => (
  <Link prefetch={false} target="_blank" rel="noopener noreferrer" {...props} />
);

/**
 * Adapt a static {@link WcProp} into the {@link PredictEvent} shape consumed by
 * the market list (`EventsUI`/`EventItem`), so props render with the exact same
 * card layout as the Markets page.
 *
 * - Binary props (Yes/No) → a single market with two outcomes (big buy buttons).
 * - Multi-outcome props → one market per outcome (3-row list + "Show More").
 */
type TFn = (key: string, options?: Record<string, unknown>) => string;

function propToEvent(prop: WcProp, isEn: boolean, t: TFn): PredictEvent {
  const title = isEn ? prop.title : prop.titleTrans || prop.title;
  // Deterministic labels (Yes/No, team names) come from i18n so they localize
  // in all 12 languages; free-text candidate labels use the backend `*_trans`.
  const label = (o: WcOutcome) => {
    const lower = o.label.toLowerCase();
    if (lower === "yes") return t("extend.worldcup.detail.trade.yes");
    if (lower === "no") return t("extend.worldcup.detail.trade.no");
    if (o.teamCode && TEAMS[o.teamCode.toUpperCase()]) {
      return t("extend.worldcup.teamName." + o.teamCode.toLowerCase());
    }
    return isEn ? o.label : o.labelTrans || o.label;
  };
  const isBinary = (prop.outcomes[0]?.label ?? "").toLowerCase() === "yes";

  const markets: PredictMarket[] = isBinary
    ? [
        {
          slug: `${prop.slug}-mkt`,
          event_slug: prop.slug,
          question: title,
          status: "open",
          source: "polymarket",
          outcomes: prop.outcomes.map((o) => ({ label: label(o), price: o.price })),
        },
      ]
    : prop.outcomes.map((o, i) => ({
        slug: `${prop.slug}-${i}`,
        event_slug: prop.slug,
        question: label(o),
        status: "open",
        source: "polymarket",
        outcomes: [{ label: label(o), price: o.price }],
      }));

  const teamCode = prop.outcomes.find((o) => o.teamCode)?.teamCode;
  const flag = teamCode ? TEAMS[teamCode.toUpperCase()]?.flag : undefined;

  return {
    slug: prop.slug,
    title,
    image_url: flag ? encodeURI(flag) : "/worldcup/fifa.webp",
    status: "open",
    volume: prop.volume,
    source: "polymarket",
    markets,
  };
}

export function PropsTab() {
  const router = useRouter();
  const { t: _t, i18n } = useTranslation();
  const t = _t as TFn;
  const isEn = (i18n.language || "en").toLowerCase().startsWith("en");
  const { data: propEvents = [], isPending } = useWorldcupProps();
  const events = useMemo(
    () => propEvents.map((p) => propToEvent(p, isEn, t)),
    [propEvents, isEn, t],
  );

  const href = (event: PredictEvent) => `/polymarket/${event.slug}`;
  const open = (event: PredictEvent) =>
    window.open(href(event), "_blank", "noopener,noreferrer");

  if (isPending) return <PropsSkeleton />;

  return (
    <div className="-mx-2">
      <EventsUI
        events={events}
        getEventHref={href}
        LinkComponent={NoPrefetchLink}
        onSelect={open}
        onSelectOutcome={open}
        onHover={(event) => router.prefetch(href(event))}
      />
    </div>
  );
}
