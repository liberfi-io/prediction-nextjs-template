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
import { useWorldcupProps } from "../../data/queries";
import { TEAMS } from "../../data/teams";
import type { WcOutcome, WcProp } from "../../types";
import { PropsSkeleton } from "../skeletons";
import { useWcLocale, type WcLocale } from "../util";

const NoPrefetchLink: LinkComponentType = (props) => (
  <Link prefetch={false} {...props} />
);

/**
 * Adapt a static {@link WcProp} into the {@link PredictEvent} shape consumed by
 * the market list (`EventsUI`/`EventItem`), so props render with the exact same
 * card layout as the Markets page.
 *
 * - Binary props (Yes/No) → a single market with two outcomes (big buy buttons).
 * - Multi-outcome props → one market per outcome (3-row list + "Show More").
 */
function propToEvent(prop: WcProp, locale: WcLocale): PredictEvent {
  const title = locale === "zh" ? prop.titleZh : prop.titleEn;
  const label = (o: WcOutcome) =>
    locale === "zh" ? (o.labelZh ?? o.label) : o.label;
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
  const locale = useWcLocale();
  const { data: propEvents = [], isPending } = useWorldcupProps();
  const events = useMemo(
    () => propEvents.map((p) => propToEvent(p, locale)),
    [propEvents, locale],
  );

  const href = (event: PredictEvent) => `/polymarket/${event.slug}`;

  if (isPending) return <PropsSkeleton />;

  return (
    <div className="-mx-2">
      <EventsUI
        events={events}
        getEventHref={href}
        LinkComponent={NoPrefetchLink}
        onSelect={(event) => router.push(href(event))}
        onSelectOutcome={(event) => router.push(href(event))}
        onHover={(event) => router.prefetch(href(event))}
      />
    </div>
  );
}
