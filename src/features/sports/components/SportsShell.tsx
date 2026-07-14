"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@liberfi.io/i18n";
import { cn } from "@liberfi.io/ui";
import type {
  SportsMatchCard as SportsMatchCardData,
  SportsPageData,
  SportsPageFilters,
  SportsPropEventCard as SportsPropEventCardData,
  SportsSection,
  SportsTaxonomyNode,
} from "../types";

interface SportsShellProps {
  section: SportsSection;
  data: SportsPageData;
  filters: SportsPageFilters;
}

export function SportsShell({ section, data, filters }: SportsShellProps) {
  const { t } = useTranslation();
  const taxonomy = useMemo(
    () => data.taxonomy?.sections?.find((item) => item.section === section),
    [data.taxonomy?.sections, section],
  );

  return (
    <main className="min-h-[calc(100vh-var(--header-height))] bg-[#09090b] text-zinc-100">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-4 px-3 py-4 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden border-r border-zinc-900 pr-4 lg:block">
          <div className="sticky top-[calc(var(--header-height)+16px)] space-y-2">
            <div className="px-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              {t(
                section === "esports"
                  ? "extend.sports.nav.esports"
                  : "extend.sports.nav.sports",
              )}
            </div>
            <TaxonomyRail
              nodes={taxonomy?.children ?? []}
              section={section}
              filters={filters}
            />
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-900 pb-3 lg:hidden">
            {(taxonomy?.children ?? []).map((node) => (
              <Link
                key={node.slug}
                href={taxonomyHref(section, filters, node)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm",
                  isTaxonomyNodeActive(filters, node)
                    ? "border-emerald-700 bg-emerald-950 text-emerald-100"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300",
                )}
              >
                {node.label}
              </Link>
            ))}
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-zinc-50">
                {t(
                  section === "esports"
                    ? "extend.sports.nav.esports"
                    : "extend.sports.nav.sports",
                )}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {data.matches.length > 0
                  ? t("extend.sports.filters.upcoming")
                  : t("extend.sports.empty.matches")}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <section className="space-y-3">
              {data.matches.length > 0 ? (
                data.matches.map((match) => (
                  <MatchCard key={match.match_group_slug} match={match} />
                ))
              ) : (
                <EmptyState label={t("extend.sports.empty.matches")} />
              )}
            </section>

            {data.props.length > 0 && (
              <section className="space-y-3">
                {data.props.map((event) => (
                  <PropEventCard key={event.event_slug} event={event} />
                ))}
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function TaxonomyRail({
  nodes,
  section,
  filters,
}: {
  nodes: SportsTaxonomyNode[];
  section: SportsSection;
  filters: SportsPageFilters;
}) {
  if (nodes.length === 0) return null;
  return (
    <nav className="space-y-1">
      {nodes.map((node) => (
        <div key={node.slug}>
          <Link
            href={taxonomyHref(section, filters, node)}
            className={cn(
              "block rounded-md px-2 py-2 text-sm font-medium hover:bg-zinc-900",
              isTaxonomyNodeActive(filters, node)
                ? "bg-zinc-900 text-emerald-100"
                : "text-zinc-300",
            )}
          >
            {node.label}
          </Link>
          {node.children && node.children.length > 0 && (
            <div className="ml-3 border-l border-zinc-900 pl-2">
              <TaxonomyRail
                nodes={node.children}
                section={section}
                filters={filters}
              />
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

function MatchCard({ match }: { match: SportsMatchCardData }) {
  return (
    <Link
      href={`/event/${encodeURIComponent(match.match_group_slug)}`}
      className="block rounded-lg border border-zinc-900 bg-zinc-950 p-3 transition-colors hover:border-zinc-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-zinc-500">
            {[
              match.sport_slug ?? match.game_slug,
              match.league_slug,
              match.status,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <h2 className="mt-1 truncate text-sm font-semibold text-zinc-100">
            {match.title}
          </h2>
        </div>
        {match.start_time && (
          <time
            className="shrink-0 text-xs text-zinc-500"
            dateTime={match.start_time}
          >
            {new Date(match.start_time).toLocaleString()}
          </time>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(match.participants ?? []).map((participant) => (
          <div
            key={`${participant.role ?? "participant"}:${participant.slug ?? participant.name}`}
            className="flex items-center gap-2 rounded-md bg-zinc-900 px-2 py-2 text-sm"
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300",
              )}
            >
              {(participant.abbreviation ?? participant.name)
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span className="min-w-0 truncate">{participant.name}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

function PropEventCard({ event }: { event: SportsPropEventCardData }) {
  return (
    <Link
      href={`/event/${encodeURIComponent(event.event_slug)}`}
      className="block rounded-lg border border-zinc-900 bg-zinc-950 p-3 transition-colors hover:border-zinc-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-zinc-500">
            {[
              event.prop_type,
              event.sport_slug ?? event.game_slug,
              event.status,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <h2 className="mt-1 truncate text-sm font-semibold text-zinc-100">
            {event.title}
          </h2>
        </div>
      </div>

      {event.markets && event.markets.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {event.markets.map((market) => (
            <div
              key={market.market_slug}
              className="rounded-md bg-zinc-900 px-3 py-2"
            >
              <div className="truncate text-xs text-zinc-500">
                {market.label}
              </div>
              <div className="mt-1 flex gap-2 overflow-hidden">
                {(market.outcomes ?? []).slice(0, 2).map((outcome) => (
                  <span
                    key={`${market.market_slug}:${outcome.outcome}`}
                    className="min-w-0 truncate text-sm font-medium text-zinc-200"
                  >
                    {outcome.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
      {label}
    </div>
  );
}

function taxonomyHref(
  section: SportsSection,
  filters: SportsPageFilters,
  node: SportsTaxonomyNode,
): string {
  const params = new URLSearchParams();
  const nextFilters = taxonomyNodeFilter(filters, node);
  for (const [key, value] of Object.entries(nextFilters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return `/${section}${qs ? `?${qs}` : ""}`;
}

function taxonomyNodeFilter(
  filters: SportsPageFilters,
  node: SportsTaxonomyNode,
): SportsPageFilters {
  if (node.node_type === "sport") return { sport_slug: node.slug };
  if (node.node_type === "game") return { game_slug: node.slug };
  if (node.node_type === "league") {
    return {
      sport_slug: filters.sport_slug,
      game_slug: filters.game_slug,
      league_slug: node.slug,
    };
  }
  if (node.node_type === "tournament") {
    return {
      sport_slug: filters.sport_slug,
      game_slug: filters.game_slug,
      league_slug: filters.league_slug,
      tournament_slug: node.slug,
    };
  }
  return filters;
}

function isTaxonomyNodeActive(
  filters: SportsPageFilters,
  node: SportsTaxonomyNode,
): boolean {
  if (node.node_type === "sport") return filters.sport_slug === node.slug;
  if (node.node_type === "game") return filters.game_slug === node.slug;
  if (node.node_type === "league") return filters.league_slug === node.slug;
  if (node.node_type === "tournament") {
    return filters.tournament_slug === node.slug;
  }
  return false;
}
