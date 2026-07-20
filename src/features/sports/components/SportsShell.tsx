"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "@liberfi.io/i18n";
import { ChevronDownIcon, cn } from "@liberfi.io/ui";
import type {
  SportsMatchCard as SportsMatchCardData,
  SportsPageData,
  SportsPageFilters,
  SportsPropEventCard as SportsPropEventCardData,
  SportsSection,
  SportsTaxonomyNode,
} from "../types";
import { LocalizedTaxonomyLabel } from "../i18n/LocalizedTaxonomyLabel";
import { isTaxonomyNodeActive, taxonomyHref } from "../route/sportsTaxonomyNav";
import { SportsStartTime } from "./SportsStartTime";
import { resolveSportsTaxonomyIcon } from "./sportsTaxonomyIcons";

interface SportsShellProps {
  section: SportsSection;
  data: SportsPageData;
  filters: SportsPageFilters;
}

export function SportsShell({ section, data, filters }: SportsShellProps) {
  const { t } = useTranslation();
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const taxonomy = useMemo(
    () => data.taxonomy?.sections?.find((item) => item.section === section),
    [data.taxonomy?.sections, section],
  );
  const taxonomyNodes = taxonomy?.children ?? [];
  const activeTopLevelSlug = findActiveTopLevelSlug(taxonomyNodes, filters);
  const [expandedTopLevelSlug, setExpandedTopLevelSlug] = useState<
    string | undefined
  >(activeTopLevelSlug);

  useEffect(() => {
    if (activeTopLevelSlug) setExpandedTopLevelSlug(activeTopLevelSlug);
  }, [activeTopLevelSlug]);
  const sectionTitle = t(
    section === "esports"
      ? "extend.sports.nav.esports"
      : "extend.sports.nav.sports",
  );

  return (
    <main className="h-full min-h-0 overflow-hidden bg-[#09090b] text-zinc-100">
      <div className="mx-auto flex h-full w-full max-w-[1440px] min-h-0 flex-col lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="no-scrollbar hidden min-h-0 overflow-y-auto border-r border-zinc-900 px-4 py-5 lg:block">
          <TaxonomyRail
            nodes={taxonomyNodes}
            section={section}
            filters={filters}
            expandedTopLevelSlug={expandedTopLevelSlug}
            onExpandedTopLevelChange={setExpandedTopLevelSlug}
          />
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-zinc-900 bg-[#09090b] px-3 pt-3 sm:px-6 lg:px-8 lg:pt-5">
            <div className="flex items-center gap-2 pb-3 lg:hidden">
              <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
                <Link
                  href={`/${section}`}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
                    !hasTaxonomyFilter(filters)
                      ? "border-emerald-700 bg-emerald-950 text-emerald-100"
                      : "border-zinc-800 bg-zinc-900 text-zinc-300",
                  )}
                >
                  {t("extend.sports.filters.all")}
                </Link>
                {taxonomyNodes.map((node) => (
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
                    <LocalizedTaxonomyLabel node={node} pageSection={section} />
                  </Link>
                ))}
              </div>
              <button
                type="button"
                aria-label={sectionTitle}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300"
                onClick={() => setFilterDrawerOpen(true)}
              >
                <span aria-hidden="true" className="grid grid-cols-2 gap-0.5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <span
                      key={index}
                      className="h-1 w-1 rounded-[1px] bg-current"
                    />
                  ))}
                </span>
              </button>
            </div>
            <div className="flex items-end justify-between gap-3 pb-4">
              <div>
                <h1 className="text-xl font-semibold text-zinc-50">
                  {sectionTitle}
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  {data.matches.length > 0
                    ? t("extend.sports.filters.upcoming")
                    : t("extend.sports.empty.matches")}
                </p>
              </div>
            </div>
          </div>

          {filterDrawerOpen && (
            <SportsFilterDrawer
              section={section}
              filters={filters}
              nodes={taxonomyNodes}
              title={sectionTitle}
              allLabel={t("extend.sports.filters.all")}
              onClose={() => setFilterDrawerOpen(false)}
              expandedTopLevelSlug={expandedTopLevelSlug}
              onExpandedTopLevelChange={setExpandedTopLevelSlug}
            />
          )}

          <div className="custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 lg:px-8">
            <div className="min-w-0 space-y-5 pb-4">
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
          </div>
        </section>
      </div>
    </main>
  );
}

function SportsFilterDrawer({
  section,
  filters,
  nodes,
  title,
  allLabel,
  onClose,
  expandedTopLevelSlug,
  onExpandedTopLevelChange,
}: {
  section: SportsSection;
  filters: SportsPageFilters;
  nodes: SportsTaxonomyNode[];
  title: string;
  allLabel: string;
  onClose: () => void;
  expandedTopLevelSlug?: string;
  onExpandedTopLevelChange: (slug: string | undefined) => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] lg:hidden">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <aside className="absolute inset-x-0 bottom-0 flex max-h-[91dvh] min-h-0 flex-col rounded-t-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-700" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-900 px-4 py-3">
          <div className="text-sm font-semibold text-zinc-100">{title}</div>
          <button
            type="button"
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 text-sm text-zinc-300"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Link
            href={`/${section}`}
            onClick={onClose}
            className={cn(
              "mb-2 block rounded-md px-2 py-2 text-sm font-medium hover:bg-zinc-900",
              !hasTaxonomyFilter(filters)
                ? "bg-zinc-900 text-emerald-100"
                : "text-zinc-300",
            )}
          >
            {allLabel}
          </Link>
          <TaxonomyRail
            nodes={nodes}
            section={section}
            filters={filters}
            onNavigate={onClose}
            expandedTopLevelSlug={expandedTopLevelSlug}
            onExpandedTopLevelChange={onExpandedTopLevelChange}
          />
        </div>
      </aside>
    </div>
  );
}

function TaxonomyRail({
  nodes,
  section,
  filters,
  onNavigate,
  parentIcon,
  expandedTopLevelSlug,
  onExpandedTopLevelChange,
  nested = false,
}: {
  nodes: SportsTaxonomyNode[];
  section: SportsSection;
  filters: SportsPageFilters;
  onNavigate?: () => void;
  parentIcon?: string;
  expandedTopLevelSlug?: string;
  onExpandedTopLevelChange?: (slug: string | undefined) => void;
  nested?: boolean;
}) {
  if (nodes.length === 0) return null;
  return (
    <nav className="space-y-1">
      {nodes.map((node) => {
        const hasChildren = Boolean(node.children?.length);
        const icon = resolveSportsTaxonomyIcon(node.slug, parentIcon);
        const isActive = isTaxonomyNodeActive(filters, node);
        const isExpanded = nested || expandedTopLevelSlug === node.slug;
        const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
          if (!nested && hasChildren) {
            if (isActive) event.preventDefault();
            onExpandedTopLevelChange?.(
              isExpanded && isActive ? undefined : node.slug,
            );
          }
          if (!event.defaultPrevented) onNavigate?.();
        };

        return (
          <div key={node.slug}>
            <Link
              href={taxonomyHref(section, filters, node)}
              onClick={handleClick}
              className={cn(
                "flex h-8 min-w-0 items-center justify-between gap-2 rounded-md px-2 text-[13px] font-medium leading-[18px] transition-colors hover:bg-content1",
                isActive ? "bg-content1 text-foreground" : "text-neutral",
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                {icon && (
                  <Image
                    src={icon}
                    alt=""
                    aria-hidden="true"
                    width={16}
                    height={16}
                    className="h-4 w-4 shrink-0 object-contain"
                  />
                )}
                <span className="truncate">
                  <LocalizedTaxonomyLabel node={node} pageSection={section} />
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-inherit">
                {typeof node.count === "number" && (
                  <span className="tabular-nums">{node.count}</span>
                )}
                {hasChildren && (
                  <ChevronDownIcon
                    aria-hidden="true"
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      isExpanded && "rotate-180",
                    )}
                  />
                )}
              </span>
            </Link>
            {hasChildren && isExpanded && (
              <div className="ml-3 pl-2">
                <TaxonomyRail
                  nodes={node.children ?? []}
                  section={section}
                  filters={filters}
                  onNavigate={onNavigate}
                  parentIcon={icon}
                  nested
                />
              </div>
            )}
          </div>
        );
      })}
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
          <SportsStartTime
            className="shrink-0 text-xs text-zinc-500"
            value={match.start_time}
          />
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

function findActiveTopLevelSlug(
  nodes: SportsTaxonomyNode[],
  filters: SportsPageFilters,
): string | undefined {
  return nodes.find((node) => taxonomyBranchContainsActiveNode(node, filters))
    ?.slug;
}

function taxonomyBranchContainsActiveNode(
  node: SportsTaxonomyNode,
  filters: SportsPageFilters,
): boolean {
  return (
    isTaxonomyNodeActive(filters, node) ||
    Boolean(
      node.children?.some((child) =>
        taxonomyBranchContainsActiveNode(child, filters),
      ),
    )
  );
}

function hasTaxonomyFilter(filters: SportsPageFilters): boolean {
  return Boolean(
    filters.sport_slug ||
    filters.game_slug ||
    filters.league_slug ||
    filters.tournament_slug,
  );
}
