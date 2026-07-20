"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@heroui/react";
import { useTranslation } from "@liberfi.io/i18n";
import {
  ChevronDownIcon,
  ModalBody,
  ModalContent,
  ModalHeader,
  StyledModal,
  XCloseIcon,
  cn,
} from "@liberfi.io/ui";
import { motion, useAnimation, useReducedMotion } from "framer-motion";
import type {
  SportsMatchCard as SportsMatchCardData,
  SportsPageData,
  SportsPageFilters,
  SportsPage,
  SportsPropEventCard as SportsPropEventCardData,
  SportsSection,
  SportsTaxonomyNode,
} from "../types";
import { fetchNextSportsPage } from "../api/client";
import { LocalizedTaxonomyLabel } from "../i18n/LocalizedTaxonomyLabel";
import { isTaxonomyNodeActive, taxonomyHref } from "../route/sportsTaxonomyNav";
import { SportsStartTime } from "./SportsStartTime";
import { resolveSportsTaxonomyIcon } from "./sportsTaxonomyIcons";

interface SportsShellProps {
  section: SportsSection;
  data: SportsPageData;
  filters: SportsPageFilters;
  lang?: string;
}

export function SportsShell({
  section,
  data,
  filters,
  lang,
}: SportsShellProps) {
  const { t } = useTranslation();
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [matches, setMatches] = useState<SportsPage<SportsMatchCardData>>(
    () => ({
      items: data.matches,
      has_more: data.match_pagination?.has_more ?? false,
      next_cursor: data.match_pagination?.next_cursor,
      limit: data.match_pagination?.limit ?? 20,
    }),
  );
  const [propPage, setPropPage] = useState<SportsPage<SportsPropEventCardData>>(
    () => ({
      items: data.props,
      has_more: data.prop_pagination?.has_more ?? false,
      next_cursor: data.prop_pagination?.next_cursor,
      limit: data.prop_pagination?.limit ?? 20,
    }),
  );
  const [loadingResource, setLoadingResource] = useState<
    "matches" | "props" | null
  >(null);

  useEffect(
    () =>
      setMatches({
        items: data.matches,
        has_more: data.match_pagination?.has_more ?? false,
        next_cursor: data.match_pagination?.next_cursor,
        limit: data.match_pagination?.limit ?? 20,
      }),
    [data.matches, data.match_pagination],
  );
  useEffect(
    () =>
      setPropPage({
        items: data.props,
        has_more: data.prop_pagination?.has_more ?? false,
        next_cursor: data.prop_pagination?.next_cursor,
        limit: data.prop_pagination?.limit ?? 20,
      }),
    [data.props, data.prop_pagination],
  );

  async function loadMore(resource: "matches" | "props") {
    const currentPage = resource === "matches" ? matches : propPage;
    if (!currentPage.has_more || !currentPage.next_cursor || loadingResource) {
      return;
    }
    setLoadingResource(resource);
    try {
      const nextPage = await fetchNextSportsPage<
        SportsMatchCardData | SportsPropEventCardData
      >({
        section,
        resource,
        taxonomy: filters.taxonomy_type
          ? {
              taxonomy_type: filters.taxonomy_type,
              taxonomy_slug: filters.taxonomy_slug,
            }
          : undefined,
        limit: currentPage.limit,
        cursor: currentPage.next_cursor,
        lang,
      });
      if (resource === "matches") {
        setMatches((current) => ({
          ...nextPage,
          items: [
            ...current.items,
            ...(nextPage.items as SportsMatchCardData[]),
          ],
        }));
      } else {
        setPropPage((current) => ({
          ...nextPage,
          items: [
            ...current.items,
            ...(nextPage.items as SportsPropEventCardData[]),
          ],
        }));
      }
    } finally {
      setLoadingResource(null);
    }
  }
  const taxonomy = useMemo(
    () => data.taxonomy?.sections?.find((item) => item.section === section),
    [data.taxonomy?.sections, section],
  );
  const taxonomyNodes = taxonomy?.children ?? [];
  const featuredNodes = taxonomy?.featured ?? [];
  const activeTopLevelSlug = findActiveTopLevelSlug(taxonomyNodes, filters);
  const mobileTaxonomyScrollTarget = isSpecialViewActive(filters, "live")
    ? "live"
    : isSpecialViewActive(filters, "proposals")
      ? "proposals"
      : activeTopLevelSlug;
  const mobileTaxonomyScrollRef = useRef<HTMLDivElement>(null);
  const [expandedTopLevelSlug, setExpandedTopLevelSlug] = useState<
    string | undefined
  >(activeTopLevelSlug);

  useEffect(() => {
    if (activeTopLevelSlug) setExpandedTopLevelSlug(activeTopLevelSlug);
  }, [activeTopLevelSlug]);

  useEffect(() => {
    const container = mobileTaxonomyScrollRef.current;
    if (!container || !mobileTaxonomyScrollTarget) return;

    const target = Array.from(
      container.querySelectorAll<HTMLElement>("[data-taxonomy-scroll-target]"),
    ).find(
      (element) =>
        element.dataset.taxonomyScrollTarget === mobileTaxonomyScrollTarget,
    );
    if (!target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const isFullyVisible =
      targetRect.left >= containerRect.left &&
      targetRect.right <= containerRect.right;
    if (isFullyVisible) return;

    target.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [mobileTaxonomyScrollTarget]);
  const sectionTitle = t(
    section === "esports"
      ? "extend.sports.nav.esports"
      : "extend.sports.nav.sports",
  );

  return (
    <main className="h-full min-h-0 overflow-hidden bg-[#09090b] text-zinc-100">
      <div className="mx-auto flex h-full w-full max-w-[1440px] min-h-0 flex-col lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="no-scrollbar hidden min-h-0 overflow-y-auto border-r border-zinc-900 px-4 py-5 lg:block">
          <SportsNavigation
            section={section}
            filters={filters}
            featuredNodes={featuredNodes}
            taxonomyNodes={taxonomyNodes}
            expandedTopLevelSlug={expandedTopLevelSlug}
            onExpandedTopLevelChange={setExpandedTopLevelSlug}
          />
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-zinc-900 bg-[#09090b] px-3 pt-3 sm:px-6 lg:px-8 lg:pt-5">
            <div className="flex items-center gap-2 pb-3 lg:hidden">
              <div
                ref={mobileTaxonomyScrollRef}
                className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
              >
                <Link
                  href={`/${section}?view=live`}
                  data-taxonomy-scroll-target="live"
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
                    isSpecialViewActive(filters, "live")
                      ? "border-emerald-700 bg-emerald-950 text-emerald-100"
                      : "border-zinc-800 bg-zinc-900 text-zinc-300",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <LiveNavigationIcon className="h-4 w-4 text-bearish" />
                    {t("extend.sports.filters.live")}
                  </span>
                </Link>
                <Link
                  href={`/${section}?view=proposals`}
                  data-taxonomy-scroll-target="proposals"
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
                    isSpecialViewActive(filters, "proposals")
                      ? "border-emerald-700 bg-emerald-950 text-emerald-100"
                      : "border-zinc-800 bg-zinc-900 text-zinc-300",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <ProposalsNavigationIcon className="h-4 w-4" />
                    {t("extend.sports.filters.proposals")}
                  </span>
                </Link>
                {taxonomyNodes.map((node) => {
                  const icon = resolveSportsTaxonomyIcon(node.slug);
                  const nodeCount = taxonomyNodeCount(node, filters);

                  return (
                    <Link
                      key={node.slug}
                      href={taxonomyHref(section, node)}
                      data-taxonomy-scroll-target={node.slug}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1.5 text-sm",
                        taxonomyBranchContainsActiveNode(node, filters)
                          ? "border-emerald-700 bg-emerald-950 text-emerald-100"
                          : "border-zinc-800 bg-zinc-900 text-zinc-300",
                      )}
                    >
                      <span className="flex items-center gap-1.5">
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
                        <LocalizedTaxonomyLabel
                          node={node}
                          pageSection={section}
                        />
                        {typeof nodeCount === "number" && nodeCount > 0 && (
                          <span className="text-[11px] tabular-nums text-zinc-500">
                            {nodeCount}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
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
                  {matches.items.length > 0
                    ? t("extend.sports.filters.upcoming")
                    : filters.view === "proposals"
                      ? t("extend.sports.filters.proposals")
                      : t("extend.sports.empty.matches")}
                </p>
              </div>
            </div>
          </div>

          {filterDrawerOpen && (
            <SportsFilterDrawer
              section={section}
              filters={filters}
              featuredNodes={featuredNodes}
              taxonomyNodes={taxonomyNodes}
              onClose={() => setFilterDrawerOpen(false)}
              expandedTopLevelSlug={expandedTopLevelSlug}
              onExpandedTopLevelChange={setExpandedTopLevelSlug}
            />
          )}

          <div className="custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 lg:px-8">
            <div className="min-w-0 space-y-5 pb-4">
              {filters.view !== "proposals" && (
                <section className="space-y-3">
                  {matches.items.length > 0 ? (
                    matches.items.map((match) => (
                      <MatchCard key={match.match_group_slug} match={match} />
                    ))
                  ) : (
                    <EmptyState label={t("extend.sports.empty.matches")} />
                  )}
                  {matches.has_more && matches.next_cursor && (
                    <LoadMoreButton
                      label={t("extend.portfolio.loadMore")}
                      loading={loadingResource === "matches"}
                      onLoad={() => void loadMore("matches")}
                    />
                  )}
                </section>
              )}

              {!isSpecialViewActive(filters, "live") && (
                <section className="space-y-3">
                  {propPage.items.length > 0 ? (
                    propPage.items.map((event) => (
                      <PropEventCard key={event.event_slug} event={event} />
                    ))
                  ) : filters.view === "proposals" ? (
                    <EmptyState label={t("extend.sports.empty.props")} />
                  ) : null}
                  {propPage.has_more && propPage.next_cursor && (
                    <LoadMoreButton
                      label={t("extend.portfolio.loadMore")}
                      loading={loadingResource === "props"}
                      onLoad={() => void loadMore("props")}
                    />
                  )}
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
  featuredNodes,
  taxonomyNodes,
  onClose,
  expandedTopLevelSlug,
  onExpandedTopLevelChange,
}: {
  section: SportsSection;
  filters: SportsPageFilters;
  featuredNodes: SportsTaxonomyNode[];
  taxonomyNodes: SportsTaxonomyNode[];
  onClose: () => void;
  expandedTopLevelSlug?: string;
  onExpandedTopLevelChange: (slug: string | undefined) => void;
}) {
  const { t } = useTranslation();

  return (
    <StyledModal
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      size="lg"
      placement="bottom"
      hideCloseButton
      backdrop="opaque"
      radius="lg"
      className="lg:hidden"
    >
      <ModalContent className="max-h-[91dvh] w-full rounded-t-2xl">
        <ModalHeader className="flex items-center justify-between pb-2 pt-4">
          <span className="text-base font-semibold">
            {t("extend.sports.filters.allSportsEvents")}
          </span>
          <Button
            isIconOnly
            onPress={onClose}
            size="sm"
            aria-label={t("extend.sports.filters.close")}
            className="h-6 w-6 min-w-6 bg-transparent"
          >
            <XCloseIcon width={20} height={20} />
          </Button>
        </ModalHeader>
        <ModalBody className="min-h-0 p-4">
          <div className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            <SportsNavigation
              section={section}
              filters={filters}
              featuredNodes={featuredNodes}
              taxonomyNodes={taxonomyNodes}
              expandedTopLevelSlug={expandedTopLevelSlug}
              onExpandedTopLevelChange={onExpandedTopLevelChange}
              showSpecialLinks={false}
            />
          </div>
        </ModalBody>
      </ModalContent>
    </StyledModal>
  );
}

function SportsNavigation({
  section,
  filters,
  featuredNodes,
  taxonomyNodes,
  onNavigate,
  expandedTopLevelSlug,
  onExpandedTopLevelChange,
  showSpecialLinks = true,
}: {
  section: SportsSection;
  filters: SportsPageFilters;
  featuredNodes: SportsTaxonomyNode[];
  taxonomyNodes: SportsTaxonomyNode[];
  onNavigate?: () => void;
  expandedTopLevelSlug?: string;
  onExpandedTopLevelChange: (slug: string | undefined) => void;
  showSpecialLinks?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="divide-y divide-zinc-800">
      {showSpecialLinks && (
        <nav className="space-y-1 py-4 first:pt-0 last:pb-0">
          <SpecialNavigationLink
            href={`/${section}?view=live`}
            label={t("extend.sports.filters.live")}
            icon="live"
            active={isSpecialViewActive(filters, "live")}
            onNavigate={onNavigate}
          />
          <SpecialNavigationLink
            href={`/${section}?view=proposals`}
            label={t("extend.sports.filters.proposals")}
            icon="proposals"
            active={isSpecialViewActive(filters, "proposals")}
            onNavigate={onNavigate}
          />
        </nav>
      )}

      {section === "sports" && featuredNodes.length > 0 && (
        <NavigationGroup title={t("extend.sports.filters.featured")}>
          <TaxonomyRail
            nodes={featuredNodes}
            section={section}
            filters={filters}
            onNavigate={onNavigate}
            nested
          />
        </NavigationGroup>
      )}

      <NavigationGroup
        title={t(
          section === "sports"
            ? "extend.sports.nav.sports"
            : "extend.sports.nav.esports",
        )}
      >
        <TaxonomyRail
          nodes={taxonomyNodes}
          section={section}
          filters={filters}
          onNavigate={onNavigate}
          expandedTopLevelSlug={expandedTopLevelSlug}
          onExpandedTopLevelChange={onExpandedTopLevelChange}
        />
      </NavigationGroup>
    </div>
  );
}

function NavigationGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SpecialNavigationLink({
  href,
  label,
  icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: "live" | "proposals";
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex h-8 items-center justify-between gap-2 rounded-md px-2 text-[13px] font-medium transition-colors hover:bg-content1",
        active ? "bg-content1 text-foreground" : "text-neutral",
      )}
    >
      <span className="flex items-center gap-1.5">
        {icon === "live" ? (
          <LiveNavigationIcon className="h-[18px] w-[18px] text-bearish" />
        ) : (
          <ProposalsNavigationIcon className="h-[18px] w-[18px]" />
        )}
        {label}
      </span>
    </Link>
  );
}

const liveWaveVariants = {
  normal: { opacity: 1, transition: { duration: 0.3 } },
  fadeOut: { opacity: 0.2, transition: { duration: 0.6 } },
  fadeIn: (wave: number) => ({
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 20,
      delay: 0.2 * wave,
    },
  }),
};

function LiveNavigationIcon({ className }: { className?: string }) {
  const controls = useAnimation();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      void controls.start("normal");
      return;
    }

    let cancelled = false;

    async function breathe() {
      while (!cancelled) {
        await controls.start("fadeOut");
        if (cancelled) return;
        await controls.start("fadeIn");
      }
    }

    void breathe();
    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [controls, reduceMotion]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      aria-hidden="true"
      data-sports-navigation-icon="live"
      data-animated="true"
      className={className}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      >
        <motion.path
          d="M5.641,12.359c-1.855-1.855-1.855-4.863,0-6.718"
          variants={liveWaveVariants}
          animate={controls}
          custom={0}
        />
        <motion.path
          d="M3.52,14.48C.493,11.454,.493,6.546,3.52,3.52"
          variants={liveWaveVariants}
          animate={controls}
          custom={1}
        />
        <circle cx="9" cy="9" r="1.75" />
        <motion.path
          d="M12.359,12.359c1.855-1.855,1.855-4.863,0-6.718"
          variants={liveWaveVariants}
          animate={controls}
          custom={0}
        />
        <motion.path
          d="M14.48,14.48c3.027-3.027,3.027-7.934,0-10.96"
          variants={liveWaveVariants}
          animate={controls}
          custom={1}
        />
      </g>
    </svg>
  );
}

function ProposalsNavigationIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      aria-hidden="true"
      data-sports-navigation-icon="proposals"
      className={className}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      >
        <rect x="2.75" y="2.75" width="12.5" height="12.5" rx="2" />
        <line x1="5.75" y1="8" x2="5.75" y2="12.25" />
        <line x1="12.25" y1="10.25" x2="12.25" y2="12.25" />
        <line x1="9" y1="5.75" x2="9" y2="12.25" />
      </g>
    </svg>
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
        const nodeCount = taxonomyNodeCount(node, filters);
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
              href={taxonomyHref(section, node)}
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
                {typeof nodeCount === "number" && nodeCount > 0 && (
                  <span className="tabular-nums">{nodeCount}</span>
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

function LoadMoreButton({
  label,
  loading,
  onLoad,
}: {
  label: string;
  loading: boolean;
  onLoad: () => void;
}) {
  return (
    <Button
      className="mx-auto flex"
      isLoading={loading}
      isDisabled={loading}
      onPress={onLoad}
      variant="flat"
    >
      {label}
    </Button>
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

function isSpecialViewActive(
  filters: SportsPageFilters,
  view: NonNullable<SportsPageFilters["view"]>,
): boolean {
  if (hasTaxonomyFilter(filters)) return false;
  return view === "live" ? filters.view !== "proposals" : filters.view === view;
}

function taxonomyNodeCount(
  node: SportsTaxonomyNode,
  filters: SportsPageFilters,
): number | undefined {
  if (!node.counts) return undefined;
  if (filters.view === "proposals") return node.counts.prop_count;
  if (filters.view === "live" || !hasTaxonomyFilter(filters)) {
    return node.counts.match_count;
  }
  return node.counts.total_count;
}

function hasTaxonomyFilter(filters: SportsPageFilters): boolean {
  return Boolean(filters.taxonomy_type && filters.taxonomy_slug);
}
