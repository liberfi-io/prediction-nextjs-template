"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { useTranslation } from "@liberfi.io/i18n";
import {
  defaultRangeExtractor,
  useVirtualizer,
  type Range,
} from "@tanstack/react-virtual";
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
  SportsParticipant,
  SportsInlineMarket,
  SportsMarket,
  SportsMarketOutcome,
  SportsSection,
  SportsTaxonomyNode,
} from "../types";
import { fetchNextSportsPage } from "../api/client";
import { LocalizedTaxonomyLabel } from "../i18n/LocalizedTaxonomyLabel";
import { isTaxonomyNodeActive, taxonomyHref } from "../route/sportsTaxonomyNav";
import { SportsStartTime } from "./SportsStartTime";
import { SportsEmptyState } from "./SportsEmptyState";
import { resolveSportsTaxonomyIcon } from "./sportsTaxonomyIcons";
import { OddsFormatSelect } from "../../worldcup/components/OddsFormatSelect";
import {
  OddsNumber,
  type OddsNumberVariant,
} from "../../worldcup/odds/OddsNumber";
import { teamButtonColors } from "../../worldcup/odds/team-button-colors";
import { useOddsFormat } from "../../worldcup/odds/OddsFormatProvider";
import { convertPrice } from "../../worldcup/odds/convert-price";
import type { OddsFormat } from "../../worldcup/odds/convert-price";

type SportsContentTab = "today" | "games" | "props";
type SportsPrimaryMarkets = Record<
  "moneyline" | "spread" | "total",
  SportsMarket[]
>;
const SPORTS_PRIMARY_MARKET_CATEGORIES = [
  "moneyline",
  "spread",
  "total",
] as const satisfies readonly (keyof SportsPrimaryMarkets)[];

const SportsPropsList = dynamic(() =>
  import("./SportsPropsList").then((module) => module.SportsPropsList),
);

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
  const [pendingTaxonomyNode, setPendingTaxonomyNode] =
    useState<SportsTaxonomyNode | null>(null);
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
  const [activeTab, setActiveTab] = useState<SportsContentTab>("games");

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
  const effectiveFilters: SportsPageFilters = pendingTaxonomyNode
    ? {
        taxonomy_type: pendingTaxonomyNode.node_type,
        taxonomy_slug: pendingTaxonomyNode.slug,
      }
    : filters;
  const handleTaxonomyNavigate = (
    event: MouseEvent<HTMLAnchorElement>,
    node: SportsTaxonomyNode,
  ): boolean => {
    if (!isPlainSameWindowNavigation(event)) return false;
    if (isTaxonomyNodeActive(effectiveFilters, node)) {
      event.preventDefault();
      return false;
    }

    setPendingTaxonomyNode(node);
    return true;
  };
  const handleSpecialViewNavigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isPlainSameWindowNavigation(event)) setPendingTaxonomyNode(null);
  };
  const activeTopLevelSlug = findActiveTopLevelSlug(
    taxonomyNodes,
    effectiveFilters,
  );
  const activeTaxonomyNode = findTaxonomyNode(taxonomyNodes, effectiveFilters);
  const hasTaxonomySelection = Boolean(activeTaxonomyNode);
  const mobileTaxonomyScrollTarget = isSpecialViewActive(
    effectiveFilters,
    "live",
  )
    ? "live"
    : isSpecialViewActive(effectiveFilters, "proposals")
      ? "proposals"
      : activeTopLevelSlug;
  const mobileTaxonomyScrollRef = useRef<HTMLDivElement>(null);
  const [expandedTopLevelSlug, setExpandedTopLevelSlug] = useState<
    string | undefined
  >(activeTopLevelSlug);

  useEffect(() => {
    if (activeTopLevelSlug) setExpandedTopLevelSlug(activeTopLevelSlug);
  }, [activeTopLevelSlug]);

  useEffect(() => setActiveTab("games"), [filters.taxonomy_slug]);
  useEffect(() => {
    if (
      pendingTaxonomyNode &&
      filters.taxonomy_type === pendingTaxonomyNode.node_type &&
      filters.taxonomy_slug === pendingTaxonomyNode.slug
    ) {
      setPendingTaxonomyNode(null);
    }
  }, [filters.taxonomy_type, filters.taxonomy_slug, pendingTaxonomyNode]);

  useEffect(() => {
    if (!pendingTaxonomyNode) return;
    const clearPendingNavigation = () => setPendingTaxonomyNode(null);
    const timeout = window.setTimeout(clearPendingNavigation, 10_000);
    window.addEventListener("popstate", clearPendingNavigation);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("popstate", clearPendingNavigation);
    };
  }, [pendingTaxonomyNode]);

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
            filters={effectiveFilters}
            featuredNodes={featuredNodes}
            taxonomyNodes={taxonomyNodes}
            expandedTopLevelSlug={expandedTopLevelSlug}
            onExpandedTopLevelChange={setExpandedTopLevelSlug}
            onTaxonomyNavigate={handleTaxonomyNavigate}
            onSpecialViewNavigate={handleSpecialViewNavigate}
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
                  onClick={handleSpecialViewNavigate}
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
                  onClick={handleSpecialViewNavigate}
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
                  const nodeCount = taxonomyNodeCount(node, effectiveFilters);

                  return (
                    <Link
                      key={node.slug}
                      href={taxonomyHref(section, node)}
                      onClick={(event) => handleTaxonomyNavigate(event, node)}
                      data-taxonomy-scroll-target={node.slug}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1.5 text-sm",
                        taxonomyBranchContainsActiveNode(node, effectiveFilters)
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
                  {activeTaxonomyNode ? (
                    <LocalizedTaxonomyLabel
                      node={activeTaxonomyNode}
                      pageSection={section}
                    />
                  ) : (
                    sectionTitle
                  )}
                </h1>
              </div>
            </div>
            {hasTaxonomySelection && (
              <SportsContentTabs active={activeTab} onChange={setActiveTab} />
            )}
          </div>

          {filterDrawerOpen && (
            <SportsFilterDrawer
              section={section}
              filters={effectiveFilters}
              featuredNodes={featuredNodes}
              taxonomyNodes={taxonomyNodes}
              onClose={() => setFilterDrawerOpen(false)}
              expandedTopLevelSlug={expandedTopLevelSlug}
              onExpandedTopLevelChange={setExpandedTopLevelSlug}
              onTaxonomyNavigate={handleTaxonomyNavigate}
            />
          )}

          <div
            id="sports-list-scroll"
            aria-busy={pendingTaxonomyNode ? "true" : undefined}
            className="custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 lg:px-8"
          >
            {pendingTaxonomyNode ? (
              <SportsListSkeleton
                loadingLabel={t("extend.leaderboard.loading")}
              />
            ) : hasTaxonomySelection ? (
              activeTab === "props" ? (
                <SportsPropsList
                  page={propPage}
                  loading={loadingResource === "props"}
                  onLoadMore={() => void loadMore("props")}
                />
              ) : (
                <SportsMatchList
                  matches={matches.items}
                  todayOnly={activeTab === "today"}
                  hasMore={matches.has_more && Boolean(matches.next_cursor)}
                  loading={loadingResource === "matches"}
                  onLoadMore={() => void loadMore("matches")}
                />
              )
            ) : (
              <div className="min-w-0 space-y-5 pb-4">
                {filters.view !== "proposals" && (
                  <section className="space-y-3">
                    <SportsMatchList
                      matches={matches.items}
                      todayOnly={false}
                      hasMore={matches.has_more && Boolean(matches.next_cursor)}
                      loading={loadingResource === "matches"}
                      onLoadMore={() => void loadMore("matches")}
                      autoLoadMore={false}
                    />
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
                      <SportsEmptyState
                        label={t("extend.sports.empty.props")}
                      />
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
            )}
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
  onTaxonomyNavigate,
}: {
  section: SportsSection;
  filters: SportsPageFilters;
  featuredNodes: SportsTaxonomyNode[];
  taxonomyNodes: SportsTaxonomyNode[];
  onClose: () => void;
  expandedTopLevelSlug?: string;
  onExpandedTopLevelChange: (slug: string | undefined) => void;
  onTaxonomyNavigate: (
    event: MouseEvent<HTMLAnchorElement>,
    node: SportsTaxonomyNode,
  ) => boolean;
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
              onTaxonomyNavigate={onTaxonomyNavigate}
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
  onTaxonomyNavigate,
  onSpecialViewNavigate,
  showSpecialLinks = true,
}: {
  section: SportsSection;
  filters: SportsPageFilters;
  featuredNodes: SportsTaxonomyNode[];
  taxonomyNodes: SportsTaxonomyNode[];
  onNavigate?: () => void;
  expandedTopLevelSlug?: string;
  onExpandedTopLevelChange: (slug: string | undefined) => void;
  onTaxonomyNavigate?: (
    event: MouseEvent<HTMLAnchorElement>,
    node: SportsTaxonomyNode,
  ) => boolean;
  onSpecialViewNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
  showSpecialLinks?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="divide-y divide-zinc-900">
      {showSpecialLinks && (
        <nav className="space-y-1 py-4 first:pt-0 last:pb-0">
          <SpecialNavigationLink
            href={`/${section}?view=live`}
            label={t("extend.sports.filters.live")}
            icon="live"
            active={isSpecialViewActive(filters, "live")}
            onNavigate={onSpecialViewNavigate}
          />
          <SpecialNavigationLink
            href={`/${section}?view=proposals`}
            label={t("extend.sports.filters.proposals")}
            icon="proposals"
            active={isSpecialViewActive(filters, "proposals")}
            onNavigate={onSpecialViewNavigate}
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
            onTaxonomyNavigate={onTaxonomyNavigate}
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
          onTaxonomyNavigate={onTaxonomyNavigate}
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
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
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
  onTaxonomyNavigate,
  parentIcon,
  expandedTopLevelSlug,
  onExpandedTopLevelChange,
  nested = false,
}: {
  nodes: SportsTaxonomyNode[];
  section: SportsSection;
  filters: SportsPageFilters;
  onNavigate?: () => void;
  onTaxonomyNavigate?: (
    event: MouseEvent<HTMLAnchorElement>,
    node: SportsTaxonomyNode,
  ) => boolean;
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
          if (!event.defaultPrevented) {
            const navigationStarted = onTaxonomyNavigate?.(event, node);
            if (navigationStarted !== false) onNavigate?.();
          }
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
                  onTaxonomyNavigate={onTaxonomyNavigate}
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

function SportsContentTabs({
  active,
  onChange,
}: {
  active: SportsContentTab;
  onChange: (tab: SportsContentTab) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="sports-content-toolbar"
      className="flex items-center justify-between gap-3 py-2"
    >
      <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto no-scrollbar">
        {(["today", "games", "props"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-current={active === tab ? "page" : undefined}
            onClick={() => onChange(tab)}
            className={cn(
              "shrink-0 cursor-pointer rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors",
              active === tab
                ? "bg-zinc-800/70 text-[#c7ff2e]"
                : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-200",
            )}
          >
            {t(`extend.worldcup.tab.${tab}`)}
          </button>
        ))}
      </nav>
      <div className="shrink-0">
        <OddsFormatSelect />
      </div>
    </div>
  );
}

type MatchListRow =
  | { kind: "heading"; id: string; title: string }
  | { kind: "match"; id: string; match: SportsMatchCardData };

/** Renders a date-group label aligned with the desktop odds columns. */
export function SportsMatchGroupHeading({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="sports-match-group-heading"
      className="flex items-center gap-3 bg-[#09090b] py-2 pl-4 pr-[17px]"
    >
      <h3 className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </h3>
      <div className="hidden shrink-0 gap-2 md:flex">
        {SPORTS_PRIMARY_MARKET_CATEGORIES.map((category) => (
          <span
            key={category}
            data-testid="sports-market-group-header"
            className="w-[128px] truncate text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
          >
            {t(`extend.worldcup.marketCol.${category}`)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Finds the date-group row that should remain sticky for a virtual range. */
export function findActiveMatchGroupIndex(
  groupIndexes: readonly number[],
  startIndex: number,
): number | undefined {
  for (let index = groupIndexes.length - 1; index >= 0; index -= 1) {
    if (groupIndexes[index] <= startIndex) return groupIndexes[index];
  }
  return groupIndexes[0];
}

function SportsMatchList({
  matches,
  todayOnly,
  hasMore,
  loading,
  onLoadMore,
  autoLoadMore = true,
}: {
  matches: SportsMatchCardData[];
  todayOnly: boolean;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  autoLoadMore?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const visibleMatches = useMemo(
    () => (todayOnly ? matchesForToday(matches) : matches),
    [matches, todayOnly],
  );
  const rows = useMemo(
    () => buildMatchRows(visibleMatches, i18n.language || "en"),
    [i18n.language, visibleMatches],
  );
  const groupIndexes = useMemo(
    () => rows.flatMap((row, index) => (row.kind === "heading" ? [index] : [])),
    [rows],
  );
  const activeGroupIndexRef = useRef<number | undefined>(groupIndexes[0]);
  const rangeExtractor = useCallback(
    (range: Range) => {
      const activeGroupIndex = findActiveMatchGroupIndex(
        groupIndexes,
        range.startIndex,
      );
      activeGroupIndexRef.current = activeGroupIndex;
      const indexes = defaultRangeExtractor(range);
      return activeGroupIndex === undefined
        ? indexes
        : Array.from(new Set([activeGroupIndex, ...indexes])).sort(
            (a, b) => a - b,
          );
    },
    [groupIndexes],
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () =>
      typeof document === "undefined"
        ? null
        : document.getElementById("sports-list-scroll"),
    estimateSize: (index) => (rows[index]?.kind === "heading" ? 38 : 168),
    overscan: 4,
    rangeExtractor,
  });
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!autoLoadMore) return;
    const last = virtualItems[virtualItems.length - 1];
    if (
      hasMore &&
      !loading &&
      (rows.length === 0 || (last && last.index >= rows.length - 3))
    ) {
      onLoadMore();
    }
  }, [autoLoadMore, hasMore, loading, onLoadMore, rows.length, virtualItems]);

  return (
    <div className="min-w-0 pb-4">
      {rows.length === 0 ? (
        <SportsEmptyState label={t("extend.sports.empty.matches")} />
      ) : (
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((item) => {
            const row = rows[item.index];
            const isActiveGroupHeading =
              row.kind === "heading" &&
              item.index === activeGroupIndexRef.current;
            return (
              <div
                key={row.id}
                ref={virtualizer.measureElement}
                data-index={item.index}
                data-sticky-active={isActiveGroupHeading || undefined}
                className={cn(
                  "left-0 w-full pb-2",
                  isActiveGroupHeading
                    ? "sticky top-0 z-20 bg-[#09090b]"
                    : "absolute top-0",
                )}
                style={
                  isActiveGroupHeading
                    ? undefined
                    : { transform: `translateY(${item.start}px)` }
                }
              >
                {isActiveGroupHeading && (
                  <div
                    data-testid="sports-sticky-gap-cover"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 -top-4 h-4 bg-[#09090b]"
                  />
                )}
                {row.kind === "heading" ? (
                  <SportsMatchGroupHeading title={row.title} />
                ) : (
                  <MatchCard match={row.match} />
                )}
              </div>
            );
          })}
        </div>
      )}
      {autoLoadMore && loading && (
        <div className="py-3 text-center text-xs text-zinc-500">
          {t("extend.portfolio.loadMore")}
        </div>
      )}
    </div>
  );
}

export function matchesForToday(
  matches: SportsMatchCardData[],
): SportsMatchCardData[] {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return matches.filter((match) => {
    const timestamp = Date.parse(match.start_time ?? "");
    return timestamp >= start.getTime() && timestamp < end.getTime();
  });
}

function buildMatchRows(
  matches: SportsMatchCardData[],
  lang: string,
): MatchListRow[] {
  const groups = new Map<string, SportsMatchCardData[]>();
  for (const match of [...matches].sort(
    (a, b) => Date.parse(a.start_time ?? "") - Date.parse(b.start_time ?? ""),
  )) {
    const timestamp = Date.parse(match.start_time ?? "");
    const title = Number.isFinite(timestamp)
      ? new Date(timestamp).toLocaleDateString(lang, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "";
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title)?.push(match);
  }
  return Array.from(groups.entries()).flatMap(([title, items]) => [
    { kind: "heading" as const, id: `heading:${title}`, title },
    ...items.map((match) => ({
      kind: "match" as const,
      id: match.match_group_slug,
      match,
    })),
  ]);
}

function MatchCard({ match }: { match: SportsMatchCardData }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [format] = useOddsFormat();
  const href = `/event/${encodeURIComponent(match.match_group_slug)}`;
  const participants = (match.participants ?? []).slice(0, 2);
  const primaryMarkets = useMemo(
    () => resolvePrimarySportsMarkets(match.inline_markets),
    [match.inline_markets],
  );
  const drawLabel = t("extend.worldcup.draw");
  const rawMoneylineSelections = sportsMarketSelections(
    "moneyline",
    primaryMarkets.moneyline,
  );
  const moneylineSlotCount = sportsMoneylineSlotCount(
    match.sport_slug,
    rawMoneylineSelections,
    participants,
  );
  const moneylineSlots = sportsMoneylineSelectionSlots(
    rawMoneylineSelections,
    participants,
    moneylineSlotCount,
  );
  const open = () => router.push(href);
  const openMarket = (market: SportsInlineMarket, outcome: string) => {
    const params = new URLSearchParams({ market: market.market_slug, outcome });
    router.push(`${href}?${params.toString()}`);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => event.key === "Enter" && open()}
      className="group cursor-pointer overflow-hidden rounded-[14px] border border-[rgba(39,39,42,0.6)] bg-[rgba(24,24,27,0.4)] transition-colors [contain-intrinsic-size:auto_140px] [content-visibility:auto] hover:border-[rgba(63,63,70,0.8)]"
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {match.start_time && (
            <SportsStartTime
              className="shrink-0 text-xs font-semibold tabular-nums text-zinc-200"
              value={match.start_time}
            />
          )}
          <span className="truncate text-xs text-zinc-500">
            {[match.league_slug, match.status].filter(Boolean).join(" · ")}
          </span>
        </div>
        {match.market_count ? (
          <span className="shrink-0 rounded-full border border-zinc-700/60 bg-zinc-800/50 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
            +{match.market_count}
          </span>
        ) : null}
      </div>

      <div className="hidden items-stretch gap-3 px-4 pb-3 pt-2.5 md:flex">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          {participants.length > 0 ? (
            participants.map((participant) => (
              <SportsParticipantRow
                key={`${participant.role ?? "participant"}:${participant.slug ?? participant.name}`}
                participant={participant}
              />
            ))
          ) : (
            <h2 className="truncate text-sm font-semibold text-zinc-100">
              {match.title}
            </h2>
          )}
        </div>
        <div className="flex shrink-0 items-stretch gap-2">
          {SPORTS_PRIMARY_MARKET_CATEGORIES.map((category) => (
            <SportsMarketColumn
              key={category}
              category={category}
              markets={primaryMarkets[category]}
              participants={participants}
              drawLabel={drawLabel}
              moneylineSlotCount={moneylineSlotCount}
              format={format}
              onSelect={openMarket}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-3 pb-3 pt-2.5 md:hidden">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <SportsMobileParticipant participant={participants[0]} />
          <span className="text-sm font-black text-zinc-500">
            {t("extend.worldcup.versus")}
          </span>
          <SportsMobileParticipant
            participant={participants[1]}
            align="right"
          />
        </div>
        {primaryMarkets.moneyline.length > 0 ? (
          <div
            className={cn(
              "grid gap-2",
              moneylineSlotCount === 3 ? "grid-cols-3" : "grid-cols-2",
            )}
          >
            {moneylineSlots.map((selection, index) =>
              selection ? (
                <SportsOddsButton
                  key={`${selection.market.market_slug}:${selection.outcome.outcome}`}
                  label={sportsMarketSelectionLabel(
                    "moneyline",
                    selection,
                    index,
                    moneylineSlotCount,
                    participants,
                    drawLabel,
                  )}
                  price={sportsOutcomePrice(selection.outcome)}
                  format={format}
                  variant="fade"
                  teamColor={sportsMarketSelectionColor(
                    "moneyline",
                    selection,
                    index,
                    moneylineSlotCount,
                    participants,
                  )}
                  onSelect={() =>
                    openMarket(selection.market, selection.outcome.outcome)
                  }
                />
              ) : (
                <SportsOddsButton
                  key={`moneyline:placeholder:${index}`}
                  label="-"
                  format={format}
                  onSelect={() => undefined}
                />
              ),
            )}
          </div>
        ) : (
          <h2 className="truncate text-center text-sm font-semibold text-zinc-100">
            {match.title}
          </h2>
        )}
      </div>
    </div>
  );
}

function SportsParticipantRow({
  participant,
}: {
  participant: SportsParticipant;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <SportsParticipantAvatar participant={participant} />
      <SportsParticipantName participant={participant} />
    </div>
  );
}

export function resolvePrimarySportsMarkets(
  inlineMarkets?: SportsInlineMarket[],
): SportsPrimaryMarkets {
  const markets: SportsMarket[] = inlineMarkets ?? [];
  const find = (aliases: string[]) =>
    markets.filter((market) => {
      const values = [market.market_type, market.market_category]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());
      return values.some((value) =>
        aliases.some(
          (alias) => value === alias || value.startsWith(`${alias}_`),
        ),
      );
    });
  return {
    moneyline: find(["moneyline", "match_winner"]),
    spread: find(["spread", "spreads", "handicap"]),
    total: find(["total", "totals", "over_under"]),
  };
}

/** A market and outcome rendered as one compact odds-button selection. */
export type SportsMarketSelection = {
  market: SportsMarket;
  outcome: SportsMarketOutcome;
};

/** Returns the selections that fit the fixed desktop market-column slots. */
export function sportsMarketSelections(
  category: keyof SportsPrimaryMarkets,
  markets: SportsMarket[],
): SportsMarketSelection[] {
  const selections =
    markets.length === 1
      ? (markets[0].outcomes ?? []).map((outcome) => ({
          market: markets[0],
          outcome,
        }))
      : markets.flatMap((market) => {
          const outcome = market.outcomes?.[0];
          return outcome ? [{ market, outcome }] : [];
        });
  return selections.slice(0, category === "moneyline" ? 3 : 2);
}

/** Semantic side represented by a moneyline selection. */
export type SportsMoneylineSide = "home" | "draw" | "away";

function sportsParticipant(
  participants: SportsParticipant[],
  role: "home" | "away",
): SportsParticipant | undefined {
  const fallbackIndex = role === "home" ? 0 : 1;
  return (
    participants.find((participant) => participant.role === role) ??
    participants[fallbackIndex]
  );
}

function sportsTextMatchesParticipant(
  text: string,
  participant?: SportsParticipant,
): boolean {
  const compactText = text.replace(/[^\p{L}\p{N}]/gu, "");
  const tokens = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return [participant?.name, participant?.slug, participant?.abbreviation]
    .filter((value): value is string => Boolean(value))
    .some((value) => {
      const normalized = value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      if (value === participant?.abbreviation) {
        return tokens.includes(normalized);
      }
      return normalized.length >= 2 && compactText.includes(normalized);
    });
}

/** Resolves whether a moneyline selection represents home, draw, or away. */
export function sportsMoneylineSelectionSide(
  selection: SportsMarketSelection,
  participants: SportsParticipant[],
): SportsMoneylineSide | undefined {
  const home = sportsParticipant(participants, "home");
  const away = sportsParticipant(participants, "away");
  const outcomeText = selection.outcome.label.toLowerCase();
  const marketLabel = selection.market.label.toLowerCase();
  const marketSlug = selection.market.market_slug.toLowerCase();
  if (/\b(?:draw|tie)\b/i.test(`${outcomeText} ${marketLabel}`)) return "draw";
  for (const text of [outcomeText, marketLabel, marketSlug]) {
    const matchesHome = sportsTextMatchesParticipant(text, home);
    const matchesAway = sportsTextMatchesParticipant(text, away);
    if (matchesHome !== matchesAway) return matchesHome ? "home" : "away";
  }
  return undefined;
}

function fallbackMoneylineSide(
  selectionIndex: number,
  selectionCount: number,
): SportsMoneylineSide | undefined {
  if (selectionCount === 3) {
    return (["home", "draw", "away"] as const)[selectionIndex];
  }
  if (selectionCount === 2) {
    return (["home", "away"] as const)[selectionIndex];
  }
  return undefined;
}

function resolvedMoneylineSelectionSide(
  selection: SportsMarketSelection,
  selectionIndex: number,
  selectionCount: number,
  participants: SportsParticipant[],
): SportsMoneylineSide | undefined {
  return (
    sportsMoneylineSelectionSide(selection, participants) ??
    fallbackMoneylineSide(selectionIndex, selectionCount)
  );
}

/** Returns the two- or three-way slot count for a moneyline group. */
export function sportsMoneylineSlotCount(
  sportSlug: string | undefined,
  selections: SportsMarketSelection[],
  participants: SportsParticipant[],
): 2 | 3 {
  const hasDraw = selections.some(
    (selection) =>
      sportsMoneylineSelectionSide(selection, participants) === "draw",
  );
  return sportSlug === "soccer" || hasDraw || selections.length >= 3 ? 3 : 2;
}

/** Places moneyline selections into fixed home, draw, and away slots. */
export function sportsMoneylineSelectionSlots(
  selections: SportsMarketSelection[],
  participants: SportsParticipant[],
  slotCount: 2 | 3,
): Array<SportsMarketSelection | undefined> {
  const slots: Array<SportsMarketSelection | undefined> =
    Array(slotCount).fill(undefined);
  const unresolved: SportsMarketSelection[] = [];
  const slotBySide: Record<SportsMoneylineSide, number | undefined> = {
    home: 0,
    draw: slotCount === 3 ? 1 : undefined,
    away: slotCount - 1,
  };
  for (const selection of selections) {
    const side = sportsMoneylineSelectionSide(selection, participants);
    const slot = side ? slotBySide[side] : undefined;
    if (slot !== undefined && !slots[slot]) {
      slots[slot] = selection;
    } else {
      unresolved.push(selection);
    }
  }
  for (const selection of unresolved) {
    const slot = slots.findIndex((value) => !value);
    if (slot < 0) break;
    slots[slot] = selection;
  }
  return slots;
}

/** Returns the compact display label for a market selection. */
export function sportsMarketSelectionLabel(
  category: keyof SportsPrimaryMarkets,
  selection: SportsMarketSelection,
  selectionIndex: number,
  selectionCount: number,
  participants: SportsParticipant[],
  drawLabel: string,
): string {
  if (category !== "moneyline") return selection.outcome.label;
  const side = resolvedMoneylineSelectionSide(
    selection,
    selectionIndex,
    selectionCount,
    participants,
  );
  if (side === "home" || side === "away") {
    const participant = sportsParticipant(participants, side);
    return (
      sportsParticipantAbbreviation(participant) ??
      participant?.name ??
      selection.outcome.label
    );
  }
  return side === "draw" ? drawLabel : selection.outcome.label;
}

/** Resolves the team color for a home/away moneyline selection. */
export function sportsMarketSelectionColor(
  category: keyof SportsPrimaryMarkets,
  selection: SportsMarketSelection,
  selectionIndex: number,
  selectionCount: number,
  participants: SportsParticipant[],
): string | undefined {
  if (category !== "moneyline") return undefined;
  const side = resolvedMoneylineSelectionSide(
    selection,
    selectionIndex,
    selectionCount,
    participants,
  );
  if (side === "home") return sportsParticipant(participants, "home")?.color;
  return side === "away"
    ? sportsParticipant(participants, "away")?.color
    : undefined;
}

function sportsOutcomePrice(outcome: SportsMarketOutcome): number | undefined {
  return outcome.price ?? outcome.best_ask ?? outcome.last_trade_price;
}

/** Matches the price-animation style used by the World Cup market columns. */
export function sportsOddsAnimationVariant(
  category: keyof SportsPrimaryMarkets,
): OddsNumberVariant {
  return category === "moneyline" ? "fade" : "roll";
}

function SportsMobileParticipant({
  participant,
  align = "left",
}: {
  participant?: SportsParticipant;
  align?: "left" | "right";
}) {
  if (!participant) return <span />;
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <SportsParticipantAvatar participant={participant} />
      <SportsParticipantName participant={participant} align={align} />
    </div>
  );
}

function SportsParticipantName({
  participant,
  align = "left",
}: {
  participant: SportsParticipant;
  align?: "left" | "right";
}) {
  const abbreviation = sportsParticipantAbbreviation(participant);

  return (
    <div
      className={cn(
        "flex min-w-0 items-baseline gap-1.5",
        align === "right" && "justify-end",
      )}
    >
      <span className="truncate text-sm font-semibold text-zinc-100">
        {participant.name}
      </span>
      {abbreviation ? (
        <span className="shrink-0 text-xs font-medium text-zinc-500">
          {abbreviation}
        </span>
      ) : null}
    </div>
  );
}

function sportsParticipantAbbreviation(
  participant?: SportsParticipant,
): string | undefined {
  return participant?.abbreviation?.trim() || undefined;
}

function SportsParticipantAvatar({
  participant,
}: {
  participant: SportsParticipant;
}) {
  return participant.logo_url ? (
    <Image
      src={participant.logo_url}
      alt=""
      aria-hidden="true"
      width={28}
      height={28}
      unoptimized
      className="h-7 w-7 shrink-0 rounded-full object-contain"
    />
  ) : (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300">
      {(participant.abbreviation ?? participant.name).slice(0, 2).toUpperCase()}
    </span>
  );
}

function SportsMarketColumn({
  category,
  markets,
  participants,
  drawLabel,
  moneylineSlotCount,
  format,
  onSelect,
}: {
  category: keyof SportsPrimaryMarkets;
  markets: SportsMarket[];
  participants: SportsParticipant[];
  drawLabel: string;
  moneylineSlotCount: 2 | 3;
  format: OddsFormat;
  onSelect: (market: SportsInlineMarket, outcome: string) => void;
}) {
  const rawSelections = sportsMarketSelections(category, markets);
  const slotCount = category === "moneyline" ? moneylineSlotCount : 2;
  const slots: Array<SportsMarketSelection | undefined> =
    category === "moneyline"
      ? sportsMoneylineSelectionSlots(
          rawSelections,
          participants,
          moneylineSlotCount,
        )
      : Array.from({ length: slotCount }, (_, index) => rawSelections[index]);
  const growButtons = category !== "moneyline";
  return (
    <div
      data-sports-market-column={category}
      className="flex h-[118px] w-[128px] flex-col gap-2"
    >
      {slots.map((selection, index) =>
        selection ? (
          <SportsOddsButton
            key={`${selection.market.market_slug}:${selection.outcome.outcome}`}
            label={sportsMarketSelectionLabel(
              category,
              selection,
              index,
              slotCount,
              participants,
              drawLabel,
            )}
            price={sportsOutcomePrice(selection.outcome)}
            format={format}
            variant={sportsOddsAnimationVariant(category)}
            grow={growButtons}
            teamColor={sportsMarketSelectionColor(
              category,
              selection,
              index,
              slotCount,
              participants,
            )}
            onSelect={() =>
              onSelect(selection.market, selection.outcome.outcome)
            }
          />
        ) : (
          <SportsOddsButton
            key={`${category}:placeholder:${index}`}
            label="-"
            format={format}
            grow={growButtons}
            onSelect={() => undefined}
          />
        ),
      )}
    </div>
  );
}

function SportsOddsButton({
  label,
  price,
  format,
  variant = "fade",
  grow = false,
  teamColor,
  onSelect,
}: {
  label: string;
  price?: number;
  format: OddsFormat;
  variant?: OddsNumberVariant;
  grow?: boolean;
  teamColor?: string;
  onSelect: () => void;
}) {
  const colors = teamButtonColors(teamColor);
  return (
    <button
      type="button"
      disabled={typeof price !== "number"}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      data-grow={grow || undefined}
      data-team-color={colors?.bg}
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 rounded-[9px] bg-[#3f3f46] px-2.5 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_3px_0_var(--sports-shadow-color)] transition-[transform,box-shadow] duration-150 ease-out will-change-transform [-webkit-tap-highlight-color:transparent] hover:translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_0_var(--sports-shadow-color)] active:translate-y-0.5 active:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_0_var(--sports-shadow-color)] disabled:cursor-not-allowed disabled:opacity-55",
        grow ? "min-h-[34px] flex-1" : "h-[34px]",
      )}
      style={
        {
          "--sports-shadow-color": colors?.shadow ?? "#1f1f23",
          ...(colors
            ? { backgroundColor: colors.bg, color: colors.text }
            : undefined),
        } as CSSProperties
      }
    >
      <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </span>
      <span className="shrink-0 text-sm font-bold tabular-nums">
        {typeof price === "number" ? (
          <OddsNumber value={convertPrice(price, format)} variant={variant} />
        ) : (
          "-"
        )}
      </span>
    </button>
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

function SportsListSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div data-sports-list-loading="true">
      <span className="sr-only" role="status">
        {loadingLabel}
      </span>
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-[14px] border border-zinc-800/60 bg-zinc-900/40 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="h-3.5 w-32 animate-pulse rounded bg-zinc-800/60" />
              <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-800/60" />
            </div>
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="h-4 w-3/5 animate-pulse rounded bg-zinc-800/60" />
                <div className="h-4 w-2/5 animate-pulse rounded bg-zinc-800/60" />
              </div>
              <div className="hidden shrink-0 gap-2 md:flex">
                {Array.from({ length: 3 }).map((_, column) => (
                  <div
                    key={column}
                    className="h-[76px] w-32 animate-pulse rounded-[9px] bg-zinc-800/50"
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
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

function findTaxonomyNode(
  nodes: SportsTaxonomyNode[],
  filters: SportsPageFilters,
): SportsTaxonomyNode | undefined {
  for (const node of nodes) {
    if (isTaxonomyNodeActive(filters, node)) return node;
    const nested = findTaxonomyNode(node.children ?? [], filters);
    if (nested) return nested;
  }
  return undefined;
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

function isPlainSameWindowNavigation(
  event: MouseEvent<HTMLAnchorElement>,
): boolean {
  const target = event.currentTarget.getAttribute("target");
  return (
    (!target || target === "_self") &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
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
