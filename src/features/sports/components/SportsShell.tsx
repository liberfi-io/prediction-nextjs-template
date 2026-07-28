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
import { flushSync } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import {
  useMarketDataResource,
  type MarketDataCapability,
  type MarketDataResourceInput,
  type MarketDataResourceState,
} from "@liberfi.io/react-predict";
import { useTranslation } from "@liberfi.io/i18n";
import {
  defaultRangeExtractor,
  useVirtualizer,
  type Range,
} from "@tanstack/react-virtual";
import {
  ChevronDownIcon,
  ChevronRightIcon,
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
  SportsTaxonomyMatchCount,
  SportsTaxonomyNode,
} from "../types";
import {
  fetchSportsPageWithMarketData,
  fetchSportsTaxonomyCounts,
} from "../api/client";
import { mergeUniqueSportsItems } from "../api/mergeUniqueSportsItems";
import { LocalizedTaxonomyLabel } from "../i18n/LocalizedTaxonomyLabel";
import { sportsLiveTimeRange } from "../live/sportsLiveTimeRange";
import {
  isTaxonomyNodeActive,
  sportsLiveHref,
  taxonomyHref,
} from "../route/sportsTaxonomyNav";
import { isPlainSameWindowNavigation } from "../route/isPlainSameWindowNavigation";
import { resolveSportsMatchRequestView } from "../route/matchRequestView";
import { SportsStartTime } from "./SportsStartTime";
import { SportsEmptyState } from "./SportsEmptyState";
import {
  SPORTS_CARD_INTERACTION_CLASS,
  SPORTS_CARD_SURFACE_CLASS,
} from "./sportsCardSurface";
import { SportsListLoadingState } from "./SportsListLoadingState";
import {
  formatSportsLiveDateRange,
  matchesForDate,
  matchesForUtcDate,
  sportsLiveDates,
  SportsLiveFilters,
} from "./SportsLiveFilters";
import { resolveSportsTaxonomyIcon } from "./sportsTaxonomyIcons";
import { sportsOutcomePrice } from "./sportsOutcomePrice";
import { OddsFormatSelect } from "../../worldcup/components/OddsFormatSelect";
import { formatVolume } from "../../worldcup/components/util";
import {
  OddsNumber,
  type OddsNumberVariant,
} from "../../worldcup/odds/OddsNumber";
import { teamButtonColors } from "../../worldcup/odds/team-button-colors";
import { useOddsFormat } from "../../worldcup/odds/OddsFormatProvider";
import { convertPrice } from "../../worldcup/odds/convert-price";
import type { OddsFormat } from "../../worldcup/odds/convert-price";
import {
  sportsMatchesForMarketDataBranch,
  sportsPropsForMarketDataBranch,
} from "../../market-data/sports";
import type { SportsMarketDataHydration } from "../../market-data/server";
import {
  initialSportsMarketDataResources,
  sportsMarketDataOwnerKey,
  updateSportsMarketDataResources,
  type SportsMarketDataResourceKind,
  type SportsMarketDataResourceUpdate,
} from "../../market-data/sportsResources";

type SportsContentTab = "today" | "games" | "props";
type SportsLiveTaxonomyOverride =
  | { kind: "route" }
  | { kind: "all" }
  | { kind: "node"; node: SportsTaxonomyNode };
type SportsLiveMatchRequest =
  | { kind: "date"; date: Date; nextRangeStart?: Date }
  | {
      kind: "taxonomy";
      date: Date;
      nextRangeStart?: Date;
      node: SportsTaxonomyNode | null;
    };
export type SportsPrimaryMarkets = Record<
  "moneyline" | "spread" | "total",
  SportsMarket[]
>;
type SportsMarketLabels = {
  draw: string;
  total: { over: string; under: string };
};
type SportsOddsLabelParts = { text: string; suffix?: string };
const SPORTS_PRIMARY_MARKET_CATEGORIES = [
  "moneyline",
  "spread",
  "total",
] as const satisfies readonly (keyof SportsPrimaryMarkets)[];
const MONEYLINE_ONLY_SPORTS = new Set([
  "tennis",
  "cricket",
  "pickleball",
  "lacrosse",
  "volleyball",
]);
const MONEYLINE_TOTAL_PRIMARY_MARKET_CATEGORIES = [
  "moneyline",
  "total",
] as const satisfies readonly (keyof SportsPrimaryMarkets)[];
const MONEYLINE_PRIMARY_MARKET_CATEGORIES = [
  "moneyline",
] as const satisfies readonly (keyof SportsPrimaryMarkets)[];

function isPreviousLiveWeekDisabled(rangeStart: Date, now: Date): boolean {
  const currentWeekStart = sportsLiveDates(rangeStart)[0] ?? rangeStart;
  const today = sportsLiveDates(now)[0] ?? now;
  return currentWeekStart.getTime() <= today.getTime();
}

function initialLiveDate(
  filters: SportsPageFilters,
  field: "start_time_gte" | "live_range_start",
): Date {
  const value = filters[field];
  return value ? new Date(value) : new Date();
}

const SportsPropsList = dynamic(
  () => import("./SportsPropsList").then((module) => module.SportsPropsList),
  { loading: SportsPropsListFallback },
);

/** Returns the primary market columns supported by a sport taxonomy. */
export function sportsPrimaryMarketCategories(
  section: SportsSection,
  sportSlug?: string,
): readonly (keyof SportsPrimaryMarkets)[] {
  if (section === "esports") {
    return MONEYLINE_TOTAL_PRIMARY_MARKET_CATEGORIES;
  }
  if (sportSlug && MONEYLINE_ONLY_SPORTS.has(sportSlug)) {
    return MONEYLINE_PRIMARY_MARKET_CATEGORIES;
  }
  if (sportSlug === "combat") {
    return MONEYLINE_TOTAL_PRIMARY_MARKET_CATEGORIES;
  }
  return SPORTS_PRIMARY_MARKET_CATEGORIES;
}

/** Returns the market columns that contain a complete list-card layout. */
export function sportsDisplayedMarketCategories(
  section: SportsSection,
  sportSlug: string | undefined,
  markets: SportsPrimaryMarkets,
): readonly (keyof SportsPrimaryMarkets)[] {
  const supportedCategories = sportsPrimaryMarketCategories(section, sportSlug);
  if (supportedCategories.length < SPORTS_PRIMARY_MARKET_CATEGORIES.length) {
    return supportedCategories;
  }
  const hasMoneyline = markets.moneyline.length > 0;
  const hasCompleteSecondaryMarkets =
    markets.spread.length > 0 && markets.total.length > 0;
  return hasMoneyline && !hasCompleteSecondaryMarkets
    ? MONEYLINE_PRIMARY_MARKET_CATEGORIES
    : SPORTS_PRIMARY_MARKET_CATEGORIES;
}

interface SportsShellProps {
  section: SportsSection;
  data: SportsPageData;
  filters: SportsPageFilters;
  lang?: string;
  marketDataCapability?: MarketDataCapability;
  marketDataResources?: SportsMarketDataHydration;
}

export function SportsShell(props: SportsShellProps) {
  if (props.marketDataCapability?.enabled) {
    const ownerKey = sportsMarketDataOwnerKey({
      section: props.section,
      lang: props.lang,
      filters: props.filters,
      hydration: props.marketDataResources,
    });
    return <SportsShellWithMarketData key={ownerKey} {...props} />;
  }
  return <SportsShellBody {...props} marketDataStates={[]} />;
}

function SportsShellWithMarketData(props: SportsShellProps) {
  const [resources, setResources] = useState(() =>
    initialSportsMarketDataResources(props.marketDataResources),
  );
  const [states, setStates] = useState<Record<string, MarketDataResourceState>>(
    {},
  );
  const updateResource = useCallback(
    (
      kind: SportsMarketDataResourceKind,
      resource: MarketDataResourceInput | undefined,
      update: SportsMarketDataResourceUpdate,
    ) => {
      setResources((current) =>
        updateSportsMarketDataResources(current, kind, resource, update),
      );
    },
    [],
  );
  const recordState = useCallback((state: MarketDataResourceState) => {
    setStates((current) =>
      current[state.key] === state
        ? current
        : { ...current, [state.key]: state },
    );
  }, []);
  const removeState = useCallback((key: string) => {
    setStates((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);
  const inputs = [...resources.matches, ...resources.props];
  return (
    <>
      {inputs.map((input) => (
        <SportsMarketDataResourceMount
          key={input.key}
          input={input}
          onState={recordState}
          onRemove={removeState}
        />
      ))}
      <SportsShellBody
        {...props}
        marketDataStates={inputs.flatMap((input) =>
          states[input.key] ? [states[input.key]] : [],
        )}
        onMarketDataResource={updateResource}
      />
    </>
  );
}

function SportsMarketDataResourceMount({
  input,
  onState,
  onRemove,
}: {
  input: MarketDataResourceInput;
  onState: (state: MarketDataResourceState) => void;
  onRemove: (key: string) => void;
}) {
  const state = useMarketDataResource(input);
  useEffect(() => onState(state), [onState, state]);
  useEffect(
    () => () => {
      onRemove(input.key);
    },
    [input.key, onRemove],
  );
  return null;
}

function SportsShellBody({
  section,
  data,
  filters,
  lang,
  marketDataCapability = { enabled: false },
  marketDataStates,
  onMarketDataResource,
}: SportsShellProps & {
  marketDataStates: MarketDataResourceState[];
  onMarketDataResource?: (
    kind: SportsMarketDataResourceKind,
    resource: MarketDataResourceInput | undefined,
    update: SportsMarketDataResourceUpdate,
  ) => void;
}) {
  const { t } = useTranslation();
  const sportsListScrollRef = useRef<HTMLDivElement>(null);
  const liveRangeRequestIdRef = useRef(0);
  const liveTaxonomyCountsRequestIdRef = useRef(0);
  const requestControllersRef = useRef(new Set<AbortController>());
  const startRequest = useCallback(() => {
    const controller = new AbortController();
    requestControllersRef.current.add(controller);
    return controller;
  }, []);
  const finishRequest = useCallback((controller: AbortController) => {
    requestControllersRef.current.delete(controller);
  }, []);
  useEffect(
    () => () => {
      requestControllersRef.current.forEach((controller) => controller.abort());
      requestControllersRef.current.clear();
    },
    [],
  );
  const getSportsListScrollElement = useCallback(
    () => sportsListScrollRef.current,
    [],
  );
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [pendingTaxonomyNode, setPendingTaxonomyNode] =
    useState<SportsTaxonomyNode | null>(null);
  const [pendingTaxonomyView, setPendingTaxonomyView] =
    useState<SportsPageFilters["view"]>();
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
  const [liveRangeLoading, setLiveRangeLoading] = useState(false);
  const [liveTaxonomyOverride, setLiveTaxonomyOverride] =
    useState<SportsLiveTaxonomyOverride>({ kind: "route" });
  const [liveTaxonomyCounts, setLiveTaxonomyCounts] = useState<
    SportsTaxonomyMatchCount[] | undefined
  >(() => data.match_taxonomy_counts);
  const [activeTab, setActiveTab] = useState<SportsContentTab>("games");
  const [displayedTab, setDisplayedTab] = useState<SportsContentTab>("games");
  const [liveDateRangeStart, setLiveDateRangeStart] = useState(() =>
    filters.live_range_start
      ? initialLiveDate(filters, "live_range_start")
      : initialLiveDate(filters, "start_time_gte"),
  );
  const [selectedLiveDate, setSelectedLiveDate] = useState(
    () =>
      sportsLiveDates(initialLiveDate(filters, "start_time_gte"))[0] ??
      new Date(),
  );
  const liveDates = useMemo(
    () => sportsLiveDates(liveDateRangeStart),
    [liveDateRangeStart],
  );
  const previousLiveWeekDisabled = isPreviousLiveWeekDisabled(
    liveDateRangeStart,
    new Date(),
  );
  const usesLiveMatchRange =
    filters.view === "live" ||
    (!filters.view && !filters.taxonomy_type && !filters.taxonomy_slug);
  const matchRequestView = resolveSportsMatchRequestView(filters);
  const requestLiveMatches = useCallback(
    async (request: SportsLiveMatchRequest) => {
      const { date } = request;
      const nextRangeStart = request.nextRangeStart;
      const taxonomyNode =
        request.kind === "taxonomy" ? (request.node ?? undefined) : undefined;
      const normalizedDate = sportsLiveDates(date)[0] ?? date;
      const normalizedRangeStart =
        sportsLiveDates(nextRangeStart ?? liveDateRangeStart)[0] ??
        nextRangeStart ??
        liveDateRangeStart;
      const timeRange = sportsLiveTimeRange(normalizedDate);
      const requestId = liveRangeRequestIdRef.current + 1;
      liveRangeRequestIdRef.current = requestId;
      flushSync(() => {
        if (nextRangeStart) {
          setLiveDateRangeStart(
            sportsLiveDates(nextRangeStart)[0] ?? nextRangeStart,
          );
        }
        setPendingTaxonomyNode(null);
        setPendingTaxonomyView(undefined);
        setLiveTaxonomyOverride(
          taxonomyNode ? { kind: "node", node: taxonomyNode } : { kind: "all" },
        );
        setSelectedLiveDate(normalizedDate);
        setLiveRangeLoading(true);
      });
      const nextHref = taxonomyNode
        ? taxonomyHref(
            section,
            taxonomyNode,
            "live",
            timeRange,
            sportsLiveTimeRange(normalizedRangeStart).start_time_gte,
          )
        : sportsLiveHref(
            section,
            timeRange,
            sportsLiveTimeRange(normalizedRangeStart).start_time_gte,
          );
      window.history[
        request.kind === "taxonomy" ? "pushState" : "replaceState"
      ](window.history.state, "", nextHref);
      if (request.kind === "date" && section === "sports") {
        const countsRequestId = liveTaxonomyCountsRequestIdRef.current + 1;
        liveTaxonomyCountsRequestIdRef.current = countsRequestId;
        const countsController = startRequest();
        void fetchSportsTaxonomyCounts(
          timeRange,
          "live",
          countsController.signal,
        )
          .then((taxonomyCounts) => {
            if (liveTaxonomyCountsRequestIdRef.current === countsRequestId) {
              setLiveTaxonomyCounts(taxonomyCounts);
            }
          })
          .catch(() => {
            if (liveTaxonomyCountsRequestIdRef.current === countsRequestId) {
              setLiveTaxonomyCounts([]);
            }
          })
          .finally(() => finishRequest(countsController));
      }
      const pageController = startRequest();
      try {
        const { page, marketDataResource } =
          await fetchSportsPageWithMarketData<SportsMatchCardData>({
            section,
            resource: "matches",
            view: "live",
            taxonomy: taxonomyNode
              ? {
                  taxonomy_type: taxonomyNode.node_type,
                  taxonomy_slug: taxonomyNode.slug,
                }
              : undefined,
            timeRange,
            limit: matches.limit,
            lang,
            marketDataEnabled: marketDataCapability.enabled,
            signal: pageController.signal,
          });
        if (liveRangeRequestIdRef.current === requestId) {
          setMatches(page);
          onMarketDataResource?.("matches", marketDataResource, "replace");
        }
      } catch {
        if (liveRangeRequestIdRef.current === requestId) {
          setMatches({ items: [], has_more: false, limit: matches.limit });
        }
      } finally {
        finishRequest(pageController);
        if (liveRangeRequestIdRef.current === requestId) {
          setLiveRangeLoading(false);
        }
      }
    },
    [
      lang,
      liveDateRangeStart,
      finishRequest,
      marketDataCapability.enabled,
      matches.limit,
      onMarketDataResource,
      section,
      startRequest,
    ],
  );
  const selectLiveWeek = useCallback(
    (date: Date) => {
      void requestLiveMatches({
        kind: "date",
        date,
        nextRangeStart: date,
      });
    },
    [requestLiveMatches],
  );
  const selectLiveToday = useCallback(() => {
    const today = new Date();
    void requestLiveMatches({
      kind: "date",
      date: today,
      nextRangeStart: today,
    });
  }, [requestLiveMatches]);
  const selectLiveDate = useCallback(
    (date: Date) => {
      void requestLiveMatches({ kind: "date", date });
    },
    [requestLiveMatches],
  );
  const selectedLiveFilterStart = filters.start_time_gte;
  const visibleLiveFilterStart = filters.live_range_start;

  useEffect(() => {
    const nextSelectedDate =
      sportsLiveDates(
        selectedLiveFilterStart
          ? new Date(selectedLiveFilterStart)
          : new Date(),
      )[0] ?? new Date();
    const nextRangeStart =
      sportsLiveDates(
        visibleLiveFilterStart
          ? new Date(visibleLiveFilterStart)
          : nextSelectedDate,
      )[0] ?? nextSelectedDate;
    setSelectedLiveDate(nextSelectedDate);
    setLiveDateRangeStart(nextRangeStart);
  }, [selectedLiveFilterStart, visibleLiveFilterStart]);

  useEffect(() => {
    liveRangeRequestIdRef.current += 1;
    liveTaxonomyCountsRequestIdRef.current += 1;
    setLiveRangeLoading(false);
    setMatches({
      items: data.matches,
      has_more: data.match_pagination?.has_more ?? false,
      next_cursor: data.match_pagination?.next_cursor,
      limit: data.match_pagination?.limit ?? 20,
    });
    setLiveTaxonomyCounts(data.match_taxonomy_counts);
  }, [data.match_taxonomy_counts, data.matches, data.match_pagination]);
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
  const visibleMatches = useMemo(
    () => ({
      ...matches,
      items: sportsMatchesForMarketDataBranch(
        matches.items,
        marketDataCapability.enabled,
        marketDataStates,
      ),
    }),
    [marketDataCapability.enabled, marketDataStates, matches],
  );
  const visiblePropPage = useMemo(
    () => ({
      ...propPage,
      items: sportsPropsForMarketDataBranch(
        propPage.items,
        marketDataCapability.enabled,
        marketDataStates,
      ),
    }),
    [marketDataCapability.enabled, marketDataStates, propPage],
  );

  async function loadMore(resource: "matches" | "props") {
    const currentPage = resource === "matches" ? matches : propPage;
    if (!currentPage.has_more || !currentPage.next_cursor || loadingResource) {
      return;
    }
    const matchRangeRequestId = liveRangeRequestIdRef.current;
    const controller = startRequest();
    setLoadingResource(resource);
    try {
      const { page: nextPage, marketDataResource } =
        await fetchSportsPageWithMarketData<
          SportsMatchCardData | SportsPropEventCardData
        >({
          section,
          resource,
          view: resource === "matches" ? matchRequestView : undefined,
          taxonomy:
            liveTaxonomyOverride.kind === "node"
              ? {
                  taxonomy_type: liveTaxonomyOverride.node.node_type,
                  taxonomy_slug: liveTaxonomyOverride.node.slug,
                }
              : liveTaxonomyOverride.kind === "route" && filters.taxonomy_type
                ? {
                    taxonomy_type: filters.taxonomy_type,
                    taxonomy_slug: filters.taxonomy_slug,
                  }
                : undefined,
          limit: currentPage.limit,
          cursor: currentPage.next_cursor,
          timeRange:
            resource === "matches" && usesLiveMatchRange
              ? sportsLiveTimeRange(selectedLiveDate)
              : resource === "matches" &&
                  filters.start_time_gte &&
                  filters.start_time_lt
                ? {
                    start_time_gte: filters.start_time_gte,
                    start_time_lt: filters.start_time_lt,
                  }
                : undefined,
          lang,
          marketDataEnabled: marketDataCapability.enabled,
          signal: controller.signal,
        });
      if (liveRangeRequestIdRef.current !== matchRangeRequestId) {
        return;
      }
      if (resource === "matches") {
        setMatches((current) => ({
          ...nextPage,
          items: mergeUniqueSportsItems(
            current.items,
            nextPage.items as SportsMatchCardData[],
            (match) => match.match_group_slug,
          ),
        }));
      } else {
        setPropPage((current) => ({
          ...nextPage,
          items: mergeUniqueSportsItems(
            current.items,
            nextPage.items as SportsPropEventCardData[],
            (event) => event.event_slug,
          ),
        }));
      }
      onMarketDataResource?.(resource, marketDataResource, "append");
    } finally {
      finishRequest(controller);
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
        ...(pendingTaxonomyView ? { view: pendingTaxonomyView } : {}),
        taxonomy_type: pendingTaxonomyNode.node_type,
        taxonomy_slug: pendingTaxonomyNode.slug,
      }
    : pendingTaxonomyView
      ? { view: pendingTaxonomyView }
      : liveTaxonomyOverride.kind === "node"
        ? {
            ...filters,
            view: "live",
            taxonomy_type: liveTaxonomyOverride.node.node_type,
            taxonomy_slug: liveTaxonomyOverride.node.slug,
          }
        : liveTaxonomyOverride.kind === "all"
          ? {
              ...filters,
              taxonomy_type: undefined,
              taxonomy_slug: undefined,
            }
          : filters;
  const primaryNavigationFilters: SportsPageFilters = isSpecialViewActive(
    effectiveFilters,
    "live",
  )
    ? { view: "live" }
    : effectiveFilters;
  const handleTaxonomyNavigate = (
    event: MouseEvent<HTMLAnchorElement>,
    node: SportsTaxonomyNode,
  ): boolean => {
    if (!isPlainSameWindowNavigation(event)) return false;
    if (isTaxonomyNodeActive(effectiveFilters, node)) {
      event.preventDefault();
      return false;
    }

    setActiveTab("games");
    setDisplayedTab("games");
    setLiveTaxonomyOverride({ kind: "route" });
    const targetView = new URL(
      event.currentTarget.href,
      window.location.origin,
    ).searchParams.get("view");
    setPendingTaxonomyView(
      targetView === "live" || targetView === "proposals"
        ? targetView
        : undefined,
    );
    setPendingTaxonomyNode(node);
    return true;
  };
  const handleSpecialViewNavigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainSameWindowNavigation(event)) return;
    const targetView = new URL(
      event.currentTarget.href,
      window.location.origin,
    ).searchParams.get("view");
    if (targetView !== "live" && targetView !== "proposals") return;
    if (
      !hasTaxonomyFilter(effectiveFilters) &&
      isSpecialViewActive(effectiveFilters, targetView)
    ) {
      event.preventDefault();
      return;
    }
    setLiveTaxonomyOverride({ kind: "route" });
    setPendingTaxonomyNode(null);
    setPendingTaxonomyView(targetView);
  };
  const activeTopLevelSlug = findActiveTopLevelSlug(
    taxonomyNodes,
    primaryNavigationFilters,
  );
  const activeTaxonomyNode = findTaxonomyNode(taxonomyNodes, effectiveFilters);
  const hasTaxonomySelection = Boolean(activeTaxonomyNode);
  const showMatchLeague = shouldShowMatchLeague(effectiveFilters);
  const isLiveView = isSpecialViewActive(effectiveFilters, "live");
  const isStandaloneProposalsView =
    !hasTaxonomySelection && isSpecialViewActive(effectiveFilters, "proposals");
  const liveTaxonomyCountByNode = useMemo(
    () =>
      liveTaxonomyCounts
        ? new Map(
            liveTaxonomyCounts.map((count) => [
              `${count.taxonomy_type}:${count.taxonomy_slug}`,
              count.match_count,
            ]),
          )
        : undefined,
    [liveTaxonomyCounts],
  );
  const handleLiveTaxonomyNavigate = (
    node: SportsTaxonomyNode,
    date: Date,
    rangeStart: Date,
  ) => {
    if (isTaxonomyNodeActive(effectiveFilters, node)) return;
    void requestLiveMatches({
      kind: "taxonomy",
      date,
      nextRangeStart: rangeStart,
      node,
    });
  };
  const handleLiveAllNavigate = (date: Date, rangeStart: Date) => {
    if (!hasTaxonomyFilter(effectiveFilters)) return;
    void requestLiveMatches({
      kind: "taxonomy",
      date,
      nextRangeStart: rangeStart,
      node: null,
    });
  };
  const liveTaxonomyItems = taxonomyNodes.map((node) => ({
    node,
    active: taxonomyBranchContainsActiveNode(node, effectiveFilters),
    count:
      liveTaxonomyCountByNode?.get(`${node.node_type}:${node.slug}`) ??
      (liveTaxonomyCountByNode ? 0 : taxonomyNodeCount(node)),
  }));
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

  useEffect(() => {
    setActiveTab("games");
    setDisplayedTab("games");
    setLiveTaxonomyOverride({ kind: "route" });
  }, [filters.taxonomy_slug, filters.taxonomy_type]);
  useEffect(() => {
    if (activeTab === displayedTab) return;
    const frame = window.requestAnimationFrame(() => {
      setDisplayedTab(activeTab);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, displayedTab]);
  useEffect(() => {
    const taxonomyArrived =
      pendingTaxonomyNode &&
      filters.taxonomy_type === pendingTaxonomyNode.node_type &&
      filters.taxonomy_slug === pendingTaxonomyNode.slug;
    const specialViewArrived =
      !pendingTaxonomyNode &&
      pendingTaxonomyView !== undefined &&
      filters.view === pendingTaxonomyView &&
      !filters.taxonomy_type &&
      !filters.taxonomy_slug;
    if (taxonomyArrived || specialViewArrived) {
      setPendingTaxonomyNode(null);
      setPendingTaxonomyView(undefined);
    }
  }, [
    filters.taxonomy_type,
    filters.taxonomy_slug,
    filters.view,
    pendingTaxonomyNode,
    pendingTaxonomyView,
  ]);

  useEffect(() => {
    if (!pendingTaxonomyNode && !pendingTaxonomyView) return;
    const clearPendingNavigation = () => {
      setPendingTaxonomyNode(null);
      setPendingTaxonomyView(undefined);
    };
    const timeout = window.setTimeout(clearPendingNavigation, 10_000);
    window.addEventListener("popstate", clearPendingNavigation);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("popstate", clearPendingNavigation);
    };
  }, [pendingTaxonomyNode, pendingTaxonomyView]);

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
  const liveDateRangeLabel = formatSportsLiveDateRange(liveDates, lang || "en");
  const isContentTabSwitching = activeTab !== displayedTab;

  return (
    <main className="h-full min-h-0 overflow-hidden bg-[#09090b] text-zinc-100">
      <div className="mx-auto flex h-full w-full max-w-[1440px] min-h-0 flex-col lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="no-scrollbar hidden min-h-0 overflow-y-auto border-r border-zinc-900 px-4 py-5 lg:block">
          <SportsNavigation
            section={section}
            filters={primaryNavigationFilters}
            featuredNodes={featuredNodes}
            taxonomyNodes={taxonomyNodes}
            expandedTopLevelSlug={expandedTopLevelSlug}
            onExpandedTopLevelChange={setExpandedTopLevelSlug}
            onTaxonomyNavigate={handleTaxonomyNavigate}
            onSpecialViewNavigate={handleSpecialViewNavigate}
          />
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            data-testid="sports-page-header"
            className={cn(
              "shrink-0 bg-[#09090b] px-3 pt-3 sm:px-6 lg:px-8 lg:pt-5",
              !isLiveView &&
                !isStandaloneProposalsView &&
                "border-b border-zinc-900",
            )}
          >
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
                    isSpecialViewActive(effectiveFilters, "live")
                      ? "border-bullish/30 bg-bullish/10 text-bullish"
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
                    isSpecialViewActive(effectiveFilters, "proposals")
                      ? "border-bullish/30 bg-bullish/10 text-bullish"
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
                  const nodeCount = taxonomyNodeCount(node);

                  return (
                    <Link
                      key={`${node.node_type}:${node.slug}`}
                      href={taxonomyHref(section, node)}
                      onClick={(event) => handleTaxonomyNavigate(event, node)}
                      data-taxonomy-scroll-target={node.slug}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1.5 text-sm",
                        taxonomyBranchContainsActiveNode(
                          node,
                          primaryNavigationFilters,
                        )
                          ? "border-bullish/30 bg-bullish/10 text-bullish"
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
                  {isLiveView ? (
                    <span className="inline-flex items-center gap-1.5">
                      <LiveNavigationIcon className="h-[18px] w-[18px] text-bearish" />
                      {t("extend.sports.filters.live")}{" "}
                      <span className="text-sm font-normal text-zinc-500">
                        ({liveDateRangeLabel})
                      </span>
                    </span>
                  ) : isStandaloneProposalsView ? (
                    t("extend.sports.filters.proposals")
                  ) : activeTaxonomyNode ? (
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
            {isLiveView && (
              <SportsLiveFilters
                section={section}
                taxonomyItems={liveTaxonomyItems}
                dates={liveDates}
                selectedDate={selectedLiveDate}
                timeRange={sportsLiveTimeRange(selectedLiveDate)}
                liveRangeStart={
                  sportsLiveTimeRange(liveDateRangeStart).start_time_gte
                }
                lang={lang || "en"}
                onDateChange={selectLiveDate}
                onToday={selectLiveToday}
                previousWeekDisabled={previousLiveWeekDisabled}
                onPreviousWeek={selectLiveWeek}
                onNextWeek={selectLiveWeek}
                onTaxonomyNavigate={handleLiveTaxonomyNavigate}
                onAllNavigate={handleLiveAllNavigate}
                trailingControl={<OddsFormatSelect />}
              />
            )}
            {hasTaxonomySelection && !isLiveView && (
              <SportsContentTabs active={activeTab} onChange={setActiveTab} />
            )}
            {isStandaloneProposalsView && <SportsProposalsOddsToolbar />}
          </div>

          {filterDrawerOpen && (
            <SportsFilterDrawer
              section={section}
              filters={primaryNavigationFilters}
              featuredNodes={featuredNodes}
              taxonomyNodes={taxonomyNodes}
              onClose={() => setFilterDrawerOpen(false)}
              expandedTopLevelSlug={expandedTopLevelSlug}
              onExpandedTopLevelChange={setExpandedTopLevelSlug}
              onTaxonomyNavigate={handleTaxonomyNavigate}
            />
          )}

          <div
            ref={sportsListScrollRef}
            id="sports-list-scroll"
            aria-busy={
              pendingTaxonomyNode ||
              pendingTaxonomyView ||
              isContentTabSwitching
                ? "true"
                : undefined
            }
            className="no-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 lg:px-8"
          >
            {pendingTaxonomyNode || pendingTaxonomyView ? (
              <SportsListLoadingState
                loadingLabel={t("extend.leaderboard.loading")}
              />
            ) : isLiveView && liveRangeLoading ? (
              <SportsListLoadingState
                loadingLabel={t("extend.leaderboard.loading")}
              />
            ) : isLiveView ? (
              <SportsMatchList
                matches={matchesForUtcDate(
                  visibleMatches.items,
                  selectedLiveDate,
                )}
                todayOnly={false}
                showLeague={showMatchLeague}
                taxonomyNodes={taxonomyNodes}
                hasMore={matches.has_more && Boolean(matches.next_cursor)}
                loading={loadingResource === "matches"}
                onLoadMore={() => void loadMore("matches")}
              />
            ) : hasTaxonomySelection ? (
              isContentTabSwitching ? (
                activeTab === "props" ? (
                  <SportsListLoadingState
                    loadingLabel={t("extend.leaderboard.loading")}
                  />
                ) : (
                  <SportsListLoadingState
                    loadingLabel={t("extend.leaderboard.loading")}
                  />
                )
              ) : displayedTab === "props" ? (
                <SportsPropsList
                  page={visiblePropPage}
                  loading={loadingResource === "props"}
                  onLoadMore={() => void loadMore("props")}
                  getScrollElement={getSportsListScrollElement}
                />
              ) : (
                <SportsMatchList
                  matches={visibleMatches.items}
                  todayOnly={displayedTab === "today"}
                  showLeague={showMatchLeague}
                  taxonomyNodes={taxonomyNodes}
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
                      matches={visibleMatches.items}
                      todayOnly={false}
                      showLeague={showMatchLeague}
                      taxonomyNodes={taxonomyNodes}
                      hasMore={matches.has_more && Boolean(matches.next_cursor)}
                      loading={loadingResource === "matches"}
                      onLoadMore={() => void loadMore("matches")}
                    />
                  </section>
                )}

                {!isSpecialViewActive(filters, "live") && (
                  <section className="space-y-3">
                    {visiblePropPage.items.length > 0 ||
                    filters.view === "proposals" ? (
                      <SportsPropsList
                        page={visiblePropPage}
                        loading={loadingResource === "props"}
                        onLoadMore={() => void loadMore("props")}
                        getScrollElement={getSportsListScrollElement}
                      />
                    ) : null}
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
        const nodeCount = taxonomyNodeCount(node);
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
          <div key={`${node.node_type}:${node.slug}`}>
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

function SportsListToolbar({
  children,
  testId,
  align = "between",
}: {
  children: ReactNode;
  testId: string;
  align?: "between" | "end";
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex min-h-12 items-center gap-3 py-2",
        align === "end" ? "justify-end" : "justify-between",
      )}
    >
      {children}
    </div>
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
    <SportsListToolbar testId="sports-content-toolbar">
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
    </SportsListToolbar>
  );
}

function SportsProposalsOddsToolbar() {
  return (
    <SportsListToolbar testId="sports-proposals-odds-toolbar" align="end">
      <div className="shrink-0">
        <OddsFormatSelect />
      </div>
    </SportsListToolbar>
  );
}

type MatchListRow =
  | {
      kind: "heading";
      id: string;
      title: string;
      categories: readonly (keyof SportsPrimaryMarkets)[];
    }
  | { kind: "match"; id: string; match: SportsMatchCardData };

const SPORTS_MATCH_GROUP_HEADING_CLASS =
  "flex items-center gap-3 bg-[#09090b] py-2 pl-4 pr-[17px]";
const SPORTS_MATCH_GROUP_ROW_HEIGHT = 40;

/** Renders a date-group label aligned with the desktop odds columns. */
export function SportsMatchGroupHeading({
  title,
  categories = SPORTS_PRIMARY_MARKET_CATEGORIES,
}: {
  title: string;
  categories?: readonly (keyof SportsPrimaryMarkets)[];
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="sports-match-group-heading"
      className={SPORTS_MATCH_GROUP_HEADING_CLASS}
    >
      <h3 className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </h3>
      <div className="hidden shrink-0 gap-2 md:flex">
        {categories.map((category) => (
          <span
            key={category}
            data-testid="sports-market-group-header"
            className={cn(
              "truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-500",
              categories.length === 1
                ? "w-[400px] text-right"
                : "w-[128px] text-center",
            )}
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
  showLeague,
  taxonomyNodes,
  hasMore,
  loading,
  onLoadMore,
}: {
  matches: SportsMatchCardData[];
  todayOnly: boolean;
  showLeague: boolean;
  taxonomyNodes: SportsTaxonomyNode[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
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
    estimateSize: (index) =>
      rows[index]?.kind === "heading" ? SPORTS_MATCH_GROUP_ROW_HEIGHT : 168,
    overscan: 4,
    rangeExtractor,
  });
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (
      hasMore &&
      !loading &&
      (rows.length === 0 || (last && last.index >= rows.length - 3))
    ) {
      onLoadMore();
    }
  }, [hasMore, loading, onLoadMore, rows.length, virtualItems]);

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
                  <SportsMatchGroupHeading
                    title={row.title}
                    categories={row.categories}
                  />
                ) : (
                  <SportsMatchCard
                    match={row.match}
                    showLeague={showLeague}
                    leagueNode={
                      showLeague && row.match.league_slug
                        ? findTaxonomyNode(taxonomyNodes, {
                            taxonomy_type: "league",
                            taxonomy_slug: row.match.league_slug,
                          })
                        : undefined
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      {loading && (
        <div className="py-3 text-center text-xs text-zinc-500">
          {t("extend.portfolio.loadMore")}
        </div>
      )}
    </div>
  );
}

/** Returns whether match cards should include their league metadata. */
export function shouldShowMatchLeague(filters: SportsPageFilters): boolean {
  return filters.taxonomy_type !== "league";
}

export function matchesForToday(
  matches: SportsMatchCardData[],
): SportsMatchCardData[] {
  return matchesForDate(matches, new Date());
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
    {
      kind: "heading" as const,
      id: `heading:${title}`,
      title,
      categories: sportsMatchGroupMarketCategories(items),
    },
    ...items.map((match) => ({
      kind: "match" as const,
      id: match.match_group_slug,
      match,
    })),
  ]);
}

function sportsMatchGroupMarketCategories(
  matches: SportsMatchCardData[],
): readonly (keyof SportsPrimaryMarkets)[] {
  const layouts = matches.map((match) =>
    sportsPrimaryMarketCategories(match.section, match.sport_slug),
  );
  const firstLayout = layouts[0] ?? SPORTS_PRIMARY_MARKET_CATEGORIES;
  return layouts.every(
    (layout) =>
      layout.length === firstLayout.length &&
      layout.every((item, index) => item === firstLayout[index]),
  )
    ? firstLayout
    : SPORTS_PRIMARY_MARKET_CATEGORIES;
}

/** Renders one responsive match card for desktop and mobile lists. */
export function SportsMatchCard({
  match,
  showLeague = false,
  leagueNode,
}: {
  match: SportsMatchCardData;
  showLeague?: boolean;
  leagueNode?: SportsTaxonomyNode;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [format] = useOddsFormat();
  const href = `/event/${encodeURIComponent(match.match_group_slug)}`;
  const participants = (match.participants ?? []).slice(0, 2);
  const primaryMarkets = useMemo(
    () => resolvePrimarySportsMarkets(match.inline_markets),
    [match.inline_markets],
  );
  const useEnglishTotalAbbreviations = i18n.language
    .toLowerCase()
    .startsWith("en");
  const marketLabels: SportsMarketLabels = {
    draw: t("extend.worldcup.draw"),
    total: {
      over: useEnglishTotalAbbreviations
        ? "O"
        : t("extend.worldcup.totalSide.over"),
      under: useEnglishTotalAbbreviations
        ? "U"
        : t("extend.worldcup.totalSide.under"),
    },
  };
  const rawMoneylineSelections = sportsMarketSelections(
    "moneyline",
    primaryMarkets.moneyline,
  );
  const moneylineSlotCount = sportsMoneylineSlotCount(
    match.sport_slug,
    rawMoneylineSelections,
    participants,
  );
  const displayedCategories = sportsDisplayedMarketCategories(
    match.section,
    match.sport_slug,
    primaryMarkets,
  );
  const open = () => router.push(href);
  const openMarket = (market: SportsInlineMarket, outcome: string) => {
    const params = new URLSearchParams({ market: market.market_slug, outcome });
    router.push(`${href}?${params.toString()}`);
  };
  return (
    <div
      className={`group [contain-intrinsic-size:auto_140px] [content-visibility:auto] ${SPORTS_CARD_SURFACE_CLASS} ${SPORTS_CARD_INTERACTION_CLASS}`}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5">
          {showLeague && match.league_slug ? (
            <>
              <span
                data-testid="sports-match-league"
                className="min-w-0 max-w-32 flex-1 truncate text-xs font-medium text-zinc-500 sm:max-w-48"
              >
                {leagueNode ? (
                  <LocalizedTaxonomyLabel
                    node={leagueNode}
                    pageSection={match.section}
                  />
                ) : (
                  match.league_slug
                )}
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 text-xs text-zinc-600"
              >
                ·
              </span>
            </>
          ) : null}
          {match.start_time && (
            <SportsStartTime
              className="shrink-0 text-xs font-semibold tabular-nums text-zinc-200"
              timeOnly
              value={match.start_time}
            />
          )}
          <span
            data-testid="sports-match-volume"
            className="shrink-0 whitespace-nowrap text-xs tabular-nums text-zinc-500"
          >
            {match.start_time ? "· " : ""}
            {formatVolume(match.volume ?? 0)} {t("extend.worldcup.volume")}
          </span>
        </div>
        {match.market_count ? (
          <button
            type="button"
            onClick={open}
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-800/50 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600/70 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <span className="tabular-nums">
              {t("extend.sports.marketCount", { count: match.market_count })}
            </span>
            <ChevronRightIcon
              aria-hidden="true"
              className="h-3 w-3 text-zinc-500"
            />
          </button>
        ) : null}
      </div>

      <div className="hidden items-stretch gap-3 px-4 pb-3 pt-2.5 md:flex">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <SportsMatchParticipants
            participants={participants}
            title={match.title}
          />
        </div>
        <div className="flex shrink-0 items-stretch gap-2">
          {displayedCategories.length === 1 ? (
            <SportsMarketColumn
              category="moneyline"
              markets={primaryMarkets.moneyline}
              participants={participants}
              labels={marketLabels}
              moneylineSlotCount={moneylineSlotCount}
              format={format}
              onSelect={openMarket}
              layout="fixed-row"
            />
          ) : (
            displayedCategories.map((category) => (
              <SportsMarketColumn
                key={category}
                category={category}
                markets={primaryMarkets[category]}
                participants={participants}
                labels={marketLabels}
                moneylineSlotCount={moneylineSlotCount}
                format={format}
                onSelect={openMarket}
              />
            ))
          )}
        </div>
      </div>

      <div
        data-testid="sports-match-card-mobile"
        className="flex flex-col gap-3 px-3 pb-3 pt-2.5 md:hidden"
      >
        <div className="flex min-w-0 flex-col gap-2">
          <SportsMatchParticipants
            participants={participants}
            title={match.title}
          />
        </div>
        {displayedCategories.map((category) => (
          <SportsMarketColumn
            key={category}
            category={category}
            markets={primaryMarkets[category]}
            participants={participants}
            labels={marketLabels}
            moneylineSlotCount={moneylineSlotCount}
            format={format}
            onSelect={openMarket}
            layout="fluid-row"
          />
        ))}
      </div>
    </div>
  );
}

function SportsMatchParticipants({
  participants,
  title,
}: {
  participants: SportsParticipant[];
  title: string;
}) {
  return participants.length > 0 ? (
    participants.map((participant) => (
      <SportsParticipantRow
        key={`${participant.role ?? "participant"}:${participant.slug ?? participant.name}`}
        participant={participant}
      />
    ))
  ) : (
    <h2 className="truncate text-sm font-semibold text-zinc-100">{title}</h2>
  );
}

function SportsParticipantRow({
  participant,
}: {
  participant: SportsParticipant;
}) {
  return (
    <div
      data-testid="sports-participant-row"
      className="flex min-w-0 items-center gap-2.5"
    >
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
  labels: SportsMarketLabels,
): string {
  const parts = sportsMarketSelectionLabelParts(
    category,
    selection,
    selectionIndex,
    selectionCount,
    participants,
    labels,
  );
  return parts.suffix ? `${parts.text} ${parts.suffix}` : parts.text;
}

function sportsMarketSelectionLabelParts(
  category: keyof SportsPrimaryMarkets,
  selection: SportsMarketSelection,
  selectionIndex: number,
  selectionCount: number,
  participants: SportsParticipant[],
  labels: SportsMarketLabels,
): SportsOddsLabelParts {
  if (category === "spread" && selection.market.line !== undefined) {
    const participant = participants.find((candidate) =>
      sportsTextMatchesParticipant(
        selection.outcome.label.toLowerCase(),
        candidate,
      ),
    );
    const participantLabel =
      sportsParticipantAbbreviation(participant) ??
      participant?.name ??
      selection.outcome.label;
    const line =
      selection.outcome.outcome === "yes"
        ? selection.market.line
        : -selection.market.line;
    return { text: participantLabel, suffix: formatSignedSportsLine(line) };
  }
  if (category === "total" && selection.market.line !== undefined) {
    const side = selection.outcome.outcome === "yes" ? "over" : "under";
    return { text: `${labels.total[side]} ${selection.market.line}` };
  }
  if (category !== "moneyline") return { text: selection.outcome.label };
  const side = resolvedMoneylineSelectionSide(
    selection,
    selectionIndex,
    selectionCount,
    participants,
  );
  if (side === "home" || side === "away") {
    const participant = sportsParticipant(participants, side);
    return {
      text:
        sportsParticipantAbbreviation(participant) ??
        participant?.name ??
        selection.outcome.label,
    };
  }
  return {
    text: side === "draw" ? labels.draw : selection.outcome.label,
  };
}

function formatSignedSportsLine(line: number): string {
  if (line === 0) return "0";
  return `${line > 0 ? "+" : ""}${line}`;
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

/** Matches the price-animation style used by the World Cup market columns. */
export function sportsOddsAnimationVariant(
  category: keyof SportsPrimaryMarkets,
): OddsNumberVariant {
  return category === "moneyline" ? "fade" : "roll";
}

function SportsParticipantName({
  participant,
}: {
  participant: SportsParticipant;
}) {
  const abbreviation = sportsParticipantAbbreviation(participant);

  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
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
      className="h-7 w-7 shrink-0 rounded-md object-contain"
    />
  ) : (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-[11px] font-semibold text-zinc-300">
      {(participant.abbreviation ?? participant.name).slice(0, 2).toUpperCase()}
    </span>
  );
}

function SportsMarketColumn({
  category,
  markets,
  participants,
  labels,
  moneylineSlotCount,
  format,
  onSelect,
  layout = "column",
}: {
  category: keyof SportsPrimaryMarkets;
  markets: SportsMarket[];
  participants: SportsParticipant[];
  labels: SportsMarketLabels;
  moneylineSlotCount: 2 | 3;
  format: OddsFormat;
  onSelect: (market: SportsInlineMarket, outcome: string) => void;
  layout?: "column" | "fixed-row" | "fluid-row";
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
  const hasThreeWayMoneyline = moneylineSlotCount === 3;
  const growButtons =
    layout === "column" && hasThreeWayMoneyline && category !== "moneyline";
  return (
    <div
      data-sports-market-column={category}
      data-sports-market-layout={layout}
      className={cn(
        layout === "column"
          ? "flex w-[128px] flex-col gap-2"
          : "grid self-center gap-2",
        layout === "fixed-row" && "w-[400px] justify-end",
        layout === "fixed-row" &&
          (slotCount === 3
            ? "grid-cols-[repeat(3,128px)]"
            : "grid-cols-[repeat(2,128px)]"),
        layout === "fluid-row" &&
          (slotCount === 3 ? "w-full grid-cols-3" : "w-full grid-cols-2"),
        layout === "column" && hasThreeWayMoneyline && "h-[118px]",
      )}
    >
      {slots.map((selection, index) => {
        if (!selection) {
          return (
            <SportsOddsButton
              key={`${category}:placeholder:${index}`}
              label="-"
              format={format}
              grow={growButtons}
              onSelect={() => undefined}
            />
          );
        }
        const labelParts = sportsMarketSelectionLabelParts(
          category,
          selection,
          index,
          slotCount,
          participants,
          labels,
        );
        return (
          <SportsOddsButton
            key={`${selection.market.market_slug}:${selection.outcome.outcome}`}
            label={labelParts.text}
            labelSuffix={labelParts.suffix}
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
        );
      })}
    </div>
  );
}

function SportsOddsButton({
  label,
  labelSuffix,
  price,
  format,
  variant = "fade",
  grow = false,
  teamColor,
  onSelect,
}: {
  label: string;
  labelSuffix?: string;
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
      <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide opacity-75">
        <span className="min-w-0 truncate">{label}</span>
        {labelSuffix && (
          <span className="shrink-0 tabular-nums">{labelSuffix}</span>
        )}
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

function SportsPropsListFallback() {
  const { t } = useTranslation();
  return (
    <SportsListLoadingState loadingLabel={t("extend.leaderboard.loading")} />
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
  if (filters.view === view) return true;
  if (hasTaxonomyFilter(filters)) return false;
  return view === "live" && filters.view === undefined;
}

function taxonomyNodeCount(node: SportsTaxonomyNode): number | undefined {
  return node.counts?.match_count;
}

function hasTaxonomyFilter(filters: SportsPageFilters): boolean {
  return Boolean(filters.taxonomy_type && filters.taxonomy_slug);
}
