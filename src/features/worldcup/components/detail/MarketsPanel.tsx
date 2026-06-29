"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import {
  useRealtimeOrderbook,
  usePredictClient,
  usePredictWsClient,
  pickBestAsk,
} from "@liberfi.io/react-predict";
import type {
  Orderbook,
  ProviderSource,
  WsDataMessage,
  WsOrderbookEvent,
} from "@liberfi.io/react-predict";
import { convertPrice } from "../../odds/convert-price";
import { displayableBuyPrice } from "../../odds/displayable-price";
import { useOddsFormat } from "../../odds/OddsFormatProvider";
import { formatVolume } from "../util";
import {
  type CategorizedMarkets,
  type MarketCategory,
  type MarketGroup,
  type MarketOption,
  allGroups,
  findSelection,
  yesAskPrice,
} from "./marketGrouping";

const BINARY_OUTCOME_TYPES = new Set([
  "both_teams_to_score",
  "both_teams_to_score_first_half",
  "both_teams_to_score_second_half",
  "soccer_game_corners_odd_even",
]);

const LINE_SELECTOR_TYPES = new Set([
  "spreads",
  "totals",
  "first_half_totals",
  "second_half_totals",
  "soccer_second_half_total_corners",
  "total_corners",
  "soccer_first_half_total_corners",
]);
const TEAM_TOTAL_SELECTOR_TYPES = new Set([
  "soccer_team_totals",
  "soccer_first_half_team_totals",
  "soccer_second_half_team_totals",
  "soccer_team_total_corners",
]);
const ITEM_BINARY_LIST_TYPES = new Set([
  "soccer_player_goals",
  "soccer_player_goals_plus_assists",
  "soccer_player_assists",
  "soccer_player_shots",
  "soccer_player_shots_on_target",
  "soccer_player_goalkeeper_saves",
]);

function stripPeriodPrefix(label: string, prefix: string): string {
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix || !label.startsWith(normalizedPrefix)) return label;
  return label.slice(normalizedPrefix.length).trimStart();
}

function marketButtonLabel(
  option: MarketOption,
  group: MarketGroup,
  firstHalfPrefix: string,
  secondHalfPrefix: string,
): string {
  if (group.type === "soccer_halftime_result") {
    return stripPeriodPrefix(option.label, firstHalfPrefix);
  }
  if (group.type === "soccer_second_half_result") {
    return stripPeriodPrefix(option.label, secondHalfPrefix);
  }
  return option.label;
}

/**
 * future.news-style Markets switcher. Lets the user browse every market type of
 * a match, filter to active markets, and pick a specific outcome/line — which
 * drives the chart, order book, trade panel and header of the detail page.
 */
export function MarketsPanel({
  cats,
  activeCategory,
  selectedSlug,
  selectedOutcome = "yes",
  onSelect,
  onInspect,
  renderInlineOrderbook,
  className,
}: {
  cats: CategorizedMarkets;
  activeCategory: MarketCategory;
  selectedSlug: string;
  selectedOutcome?: "yes" | "no";
  onSelect: (slug: string, outcome?: "yes" | "no") => void;
  onInspect?: (slug: string, outcome?: "yes" | "no") => void;
  renderInlineOrderbook?: (slug: string, outcome: "yes" | "no") => ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();

  const [category, setCategory] = useState<MarketCategory>(activeCategory);
  const [expandedMarket, setExpandedMarket] = useState<{
    groupKey: string;
    slug: string;
    outcome: "yes" | "no";
  } | null>(null);

  // The selected market also has a live order book on screen; subscribe to its
  // YES book so the panel's displayed price for that market tracks the order
  // book's best ask in real time (the 30s event poll only refreshes the static
  // snapshot, which drifts from the live WS book).
  const selectedMarket = useMemo(
    () =>
      selectedSlug
        ? findSelection(cats, selectedSlug, selectedOutcome)?.option.market
        : undefined,
    [cats, selectedOutcome, selectedSlug],
  );
  const { data: liveOrderbook } = useRealtimeOrderbook(
    {
      slug: selectedMarket?.slug ?? "",
      source: selectedMarket?.source ?? "polymarket",
      outcome: "yes",
    },
    { enabled: Boolean(selectedMarket) && selectedMarket?.status === "open" },
  );
  const liveSelectedPrice = useMemo(() => {
    if (
      !selectedMarket ||
      liveOrderbook?.market_id !== selectedMarket.slug ||
      liveOrderbook?.outcome !== "yes"
    ) {
      return null;
    }
    const ask = pickBestAsk(liveOrderbook, "yes");
    return ask != null && ask > 0 ? ask : null;
  }, [liveOrderbook, selectedMarket]);

  const categoryTabs = useMemo(
    () =>
      (
        [
          ["gameLines", cats.gameLines],
          ["exactScore", cats.exactScore],
          ["halftime", cats.halftime],
          ["secondHalf", cats.secondHalf],
          ["corners", cats.corners],
          ["goals", cats.goals],
          ["assists", cats.assists],
          ["shots", cats.shots],
          ["saves", cats.saves],
          ["other", cats.other],
        ] as [MarketCategory, MarketGroup[]][]
      ).filter(([, groups]) => groups.length > 0),
    [cats],
  );

  const groups = useMemo<MarketGroup[]>(() => cats[category], [cats, category]);
  const visibleMarkets = useMemo(() => {
    const bySlug = new Map<string, MarketOption["market"]>();
    for (const group of groups) {
      for (const option of group.options) {
        bySlug.set(option.market.slug, option.market);
      }
    }
    return [...bySlug.values()];
  }, [groups]);
  // Every open market of the match, across all category tabs. Feeding the whole
  // set to the price hook means switching tabs needs no fresh subscribe/fetch —
  // the prices are already live and seeded.
  const allOpenMarkets = useMemo(() => {
    const bySlug = new Map<string, MarketOption["market"]>();
    for (const group of allGroups(cats)) {
      for (const option of group.options) {
        if (option.market.status === "open") {
          bySlug.set(option.market.slug, option.market);
        }
      }
    }
    return [...bySlug.values()];
  }, [cats]);
  // Markets in the current tab — seeded first so the visible tab fills before
  // the rest stream in behind it.
  const prioritySlugs = useMemo(
    () =>
      new Set(
        visibleMarkets
          .filter((market) => market.status === "open")
          .map((market) => market.slug),
      ),
    [visibleMarkets],
  );
  const orderbookPricesBySlug = useVisibleOrderbookPrices(
    allOpenMarkets,
    selectedMarket?.slug,
    liveSelectedPrice,
    prioritySlugs,
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-[12px] border border-zinc-800 bg-zinc-900/40",
        className,
      )}
    >
      {/* Category tabs */}
      {categoryTabs.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categoryTabs.map(([key]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                "shrink-0 rounded-[8px] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                category === key
                  ? "bg-zinc-800 text-[#c7ff2e]"
                  : "text-zinc-500 hover:text-zinc-200",
              )}
            >
              {t(`extend.worldcup.detail.markets.category.${key}`)}
            </button>
          ))}
        </div>
      )}

      {/* Groups */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5 [scrollbar-width:thin]">
        {groups.map((group) => (
          <GroupRow
            key={group.key}
            group={group}
            options={group.options}
            selectedSlug={selectedSlug}
            selectedOutcome={selectedOutcome}
            orderbookPricesBySlug={orderbookPricesBySlug}
            onSelect={onSelect}
            onInspect={onInspect}
            expandedSelection={
              expandedMarket?.groupKey === group.key ? expandedMarket : null
            }
            onExpand={(slug, nextOutcome) =>
              setExpandedMarket({
                groupKey: group.key,
                slug,
                outcome: nextOutcome,
              })
            }
            renderInlineOrderbook={renderInlineOrderbook}
            label={t(`extend.worldcup.detail.markets.type.${group.type_label}`)}
          />
        ))}
      </div>
    </div>
  );
}

function LineSelectorContent({
  group,
  options,
  activeLineKey,
  lineOptions,
  selectedSlug,
  selectedOutcome,
  optionOdds,
  onSelect,
  onInspect,
  expandedSelection,
  onExpand,
  onLineChange,
}: {
  group: MarketGroup;
  options: MarketOption[];
  activeLineKey: string;
  lineOptions: { key: string; value: number }[];
  selectedSlug: string;
  selectedOutcome: "yes" | "no";
  optionOdds: (option: MarketOption) => string | null;
  onSelect: (slug: string, outcome?: "yes" | "no") => void;
  onInspect?: (slug: string, outcome?: "yes" | "no") => void;
  expandedSelection?: { slug: string; outcome: "yes" | "no" } | null;
  onExpand?: (slug: string, outcome: "yes" | "no") => void;
  onLineChange: (key: string) => void;
}) {
  const { t } = useTranslation();
  const firstHalfPrefix = String(t("extend.worldcup.firstHalfPrefix"));
  const secondHalfPrefix = String(t("extend.worldcup.secondHalfPrefix"));
  const isTotals = group.type !== "spreads";
  const lineButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const activeLineIndex = lineOptions.findIndex((line) => line.key === activeLineKey);
  const lineOptionsForButtons = options.filter(
    (option) => lineKey(lineValue(option)) === activeLineKey,
  );
  const tradeOptions = isTotals
    ? buildTotalsTradeOptions(
        lineOptionsForButtons[0],
        t("extend.worldcup.totalSide.over"),
        t("extend.worldcup.totalSide.under"),
      )
    : buildSpreadTradeOptions(lineOptionsForButtons);
  const selectedOption = useMemo(
    () =>
      options.find(
        (option) =>
          option.market.slug === selectedSlug &&
          (option.outcome ?? "yes") === selectedOutcome,
      ),
    [options, selectedOutcome, selectedSlug],
  );
  const centerLine = useCallback((key: string) => {
    window.requestAnimationFrame(() => {
      const button = lineButtonRefs.current.get(key);
      const scroller = button?.parentElement;
      if (!button || !scroller) return;
      scroller.scrollTo({
        left: button.offsetLeft + button.offsetWidth / 2 - scroller.clientWidth / 2,
        behavior: "smooth",
      });
    });
  }, []);
  const selectLine = useCallback(
    (key: string) => {
      const lineOptionsForNextButtons = options.filter(
        (option) => lineKey(lineValue(option)) === key,
      );
      const nextTradeOptions = isTotals
        ? buildTotalsTradeOptions(
            lineOptionsForNextButtons[0],
            t("extend.worldcup.totalSide.over"),
            t("extend.worldcup.totalSide.under"),
          )
        : buildSpreadTradeOptions(lineOptionsForNextButtons);
      const preferredSide = selectedOption?.side ?? (isTotals ? "over" : "home");
      const preferredOutcome = isTotals ? selectedOutcome : selectedOption?.outcome;
      const nextOption =
        nextTradeOptions.find(
          (option) =>
            option.side === preferredSide &&
            (preferredOutcome === undefined ||
              (option.outcome ?? "yes") === preferredOutcome),
        ) ??
        nextTradeOptions.find((option) => option.side === preferredSide) ??
        nextTradeOptions[0];

      onLineChange(key);
      if (nextOption) {
        const nextOutcome = nextOption.outcome ?? "yes";
        onExpand?.(nextOption.market.slug, nextOutcome);
        onInspect?.(nextOption.market.slug, nextOutcome);
      }
      centerLine(key);
    },
    [
      centerLine,
      isTotals,
      onExpand,
      onInspect,
      onLineChange,
      options,
      selectedOption?.outcome,
      selectedOption?.side,
      selectedOutcome,
      t,
    ],
  );

  useEffect(() => {
    centerLine(activeLineKey);
  }, [activeLineKey, centerLine]);
  const selectAdjacentLine = useCallback(
    (direction: -1 | 1) => {
      if (activeLineIndex < 0) return;
      const nextLine = lineOptions[activeLineIndex + direction];
      if (!nextLine) return;
      selectLine(nextLine.key);
    },
    [activeLineIndex, lineOptions, selectLine],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className={cn("grid gap-1.5", isTotals ? "grid-cols-2" : "grid-cols-2")}>
        {tradeOptions.map((option) => {
          const outcome = option.outcome ?? "yes";
          const selected = option.market.slug === selectedSlug && outcome === selectedOutcome;
          const odds = optionOdds(option);
          return (
            <button
              key={`${option.market.slug}:${outcome}:${option.side ?? "line"}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (expandedSelection) onExpand?.(option.market.slug, outcome);
                onSelect(option.market.slug, outcome);
              }}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-[8px] border px-2 py-2 text-center transition-colors cursor-pointer",
                selected
                  ? "border-[#c7ff2e]/60 bg-[#c7ff2e]/10 text-[#c7ff2e]"
                  : "border-zinc-700/60 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100",
              )}
            >
              <span className="max-w-full truncate text-xs font-medium leading-tight">
                {marketButtonLabel(option, group, firstHalfPrefix, secondHalfPrefix)}
              </span>
              <span className="text-sm font-bold leading-tight tabular-nums text-bearish">
                {odds ?? "-"}
              </span>
            </button>
          );
        })}
      </div>

      {lineOptions.length > 1 && (
        <div className="relative flex h-12 items-center overflow-hidden border-t border-zinc-800/70 bg-zinc-950/60">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[-3px] z-10 -translate-x-1/2 text-[#c7ff2e]"
          >
            <path
              d="M9.1 2.5H2.9c-.55 0-1.06.3-1.32.79-.26.49-.23 1.08.07 1.54l3.1 4.65c.28.42.75.67 1.25.67s.97-.25 1.25-.67l3.1-4.65c.31-.46.34-1.05.08-1.54-.26-.49-.77-.79-1.33-.79Z"
              fill="currentColor"
            />
          </svg>
          <button
            type="button"
            aria-label="Previous line"
            disabled={activeLineIndex <= 0}
            onClick={() => selectAdjacentLine(-1)}
            className={cn(
              "absolute left-0 top-0 z-20 flex h-full w-8 cursor-pointer items-center justify-start bg-gradient-to-r from-zinc-950/95 to-transparent pl-1 text-lg font-semibold text-zinc-500 transition-colors",
              activeLineIndex > 0
                ? "hover:text-zinc-100"
                : "cursor-default opacity-35",
            )}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path
                d="M10 3.5 5.5 8l4.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
          <div
            className="flex h-12 min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden px-[calc(50%_-_20px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {lineOptions.map((line) => {
              const active = line.key === activeLineKey;
              return (
                <button
                  key={line.key}
                  ref={(node) => {
                    if (node) lineButtonRefs.current.set(line.key, node);
                    else lineButtonRefs.current.delete(line.key);
                  }}
                  type="button"
                  onClick={() => selectLine(line.key)}
                  className={cn(
                    "flex h-12 w-10 shrink-0 cursor-pointer items-center justify-center px-3 text-[13px] font-semibold tabular-nums transition-colors",
                    active
                      ? "text-[#c7ff2e]"
                      : "text-zinc-500 hover:text-zinc-100",
                  )}
                >
                  {group.type === "spreads"
                    ? formatSignedLine(line.value)
                    : formatPlainLine(line.value)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Next line"
            disabled={activeLineIndex < 0 || activeLineIndex >= lineOptions.length - 1}
            onClick={() => selectAdjacentLine(1)}
            className={cn(
              "absolute right-0 top-0 z-20 flex h-full w-8 cursor-pointer items-center justify-end bg-gradient-to-l from-zinc-950/95 to-transparent pr-1 text-lg font-semibold text-zinc-500 transition-colors",
              activeLineIndex >= 0 && activeLineIndex < lineOptions.length - 1
                ? "hover:text-zinc-100"
                : "cursor-default opacity-35",
            )}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path
                d="m6 3.5 4.5 4.5L6 12.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function buildTotalsTradeOptions(
  option: MarketOption | undefined,
  overLabel: string,
  underLabel: string,
): MarketOption[] {
  if (!option) return [];
  return [
    {
      ...option,
      label: overLabel,
      outcome: "yes",
      side: "over",
    },
    {
      ...option,
      label: underLabel,
      outcome: "no",
      side: "under",
    },
  ];
}

function TeamTotalsContent({
  group,
  options,
  selectedSlug,
  selectedOutcome,
  optionOdds,
  onSelect,
  onInspect,
  expandedSelection,
  onExpand,
}: {
  group: MarketGroup;
  options: MarketOption[];
  selectedSlug: string;
  selectedOutcome: "yes" | "no";
  optionOdds: (option: MarketOption) => string | null;
  onSelect: (slug: string, outcome?: "yes" | "no") => void;
  onInspect?: (slug: string, outcome?: "yes" | "no") => void;
  expandedSelection?: { slug: string; outcome: "yes" | "no" } | null;
  onExpand?: (slug: string, outcome: "yes" | "no") => void;
}) {
  const knownSides = (["home", "away"] as const)
    .map((side) => ({
      side,
      options: options.filter((option) => option.teamSide === side),
    }))
    .filter(({ options: sideOptions }) => sideOptions.length > 0);
  const fallbackOptions = options.filter((option) => !option.teamSide);

  return (
    <div className="flex flex-col gap-3">
      {knownSides.map(({ side, options: sideOptions }) => (
        <TeamTotalsLineGroup
          key={side}
          group={group}
          options={sideOptions}
          label={sideOptions[0]?.label ?? ""}
          selectedSlug={selectedSlug}
          selectedOutcome={selectedOutcome}
          optionOdds={optionOdds}
          onSelect={onSelect}
          onInspect={onInspect}
          expandedSelection={expandedSelection}
          onExpand={onExpand}
        />
      ))}
      {fallbackOptions.length > 0 && (
        <TeamTotalsLineGroup
          group={group}
          options={fallbackOptions}
          label={fallbackOptions[0]?.label ?? ""}
          selectedSlug={selectedSlug}
          selectedOutcome={selectedOutcome}
          optionOdds={optionOdds}
          onSelect={onSelect}
          onInspect={onInspect}
          expandedSelection={expandedSelection}
          onExpand={onExpand}
        />
      )}
    </div>
  );
}

function ExactScoreContent({
  options,
  selectedSlug,
  selectedOutcome,
  optionOdds,
  onSelect,
  onInspect,
  expandedSelection,
  onExpand,
}: {
  options: MarketOption[];
  selectedSlug: string;
  selectedOutcome: "yes" | "no";
  optionOdds: (option: MarketOption) => string | null;
  onSelect: (slug: string, outcome?: "yes" | "no") => void;
  onInspect?: (slug: string, outcome?: "yes" | "no") => void;
  expandedSelection?: { slug: string; outcome: "yes" | "no" } | null;
  onExpand?: (slug: string, outcome: "yes" | "no") => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => {
        const yesOption: MarketOption = {
          ...option,
          label: t("extend.worldcup.detail.trade.yes"),
          outcome: "yes",
        };
        const noOption: MarketOption = {
          ...option,
          label: t("extend.worldcup.detail.trade.no"),
          outcome: "no",
        };
        return (
          <div
            key={option.market.slug}
            className="flex flex-col gap-1.5"
            onClick={(event) => {
              const target = event.target as HTMLElement | null;
              if (target?.closest("button,a,input,select,textarea")) return;
              event.stopPropagation();
              const nextOutcome = option.outcome ?? "yes";
              onExpand?.(option.market.slug, nextOutcome);
              onInspect?.(option.market.slug, nextOutcome);
            }}
          >
            <div className="truncate text-xs font-medium text-zinc-400">
              {option.label}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[yesOption, noOption].map((outcomeOption) => {
                const outcome = outcomeOption.outcome ?? "yes";
                const selected =
                  outcomeOption.market.slug === selectedSlug &&
                  outcome === selectedOutcome;
                const odds = optionOdds(outcomeOption);
                return (
                  <button
                    key={`${outcomeOption.market.slug}:${outcome}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (expandedSelection) {
                        onExpand?.(outcomeOption.market.slug, outcome);
                      }
                      onSelect(outcomeOption.market.slug, outcome);
                    }}
                    className={cn(
                      "flex min-w-0 flex-col items-center justify-center gap-1 rounded-[8px] border px-2 py-2 text-center transition-colors cursor-pointer",
                      selected
                        ? "border-[#c7ff2e]/60 bg-[#c7ff2e]/10 text-[#c7ff2e]"
                        : "border-zinc-700/60 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100",
                    )}
                  >
                    <span className="max-w-full truncate text-xs font-medium leading-tight">
                      {outcomeOption.label}
                    </span>
                    <span className="text-sm font-bold leading-tight tabular-nums text-bearish">
                      {odds ?? "-"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TeamTotalsLineGroup({
  group,
  options,
  label,
  selectedSlug,
  selectedOutcome,
  optionOdds,
  onSelect,
  onInspect,
  expandedSelection,
  onExpand,
}: {
  group: MarketGroup;
  options: MarketOption[];
  label: string;
  selectedSlug: string;
  selectedOutcome: "yes" | "no";
  optionOdds: (option: MarketOption) => string | null;
  onSelect: (slug: string, outcome?: "yes" | "no") => void;
  onInspect?: (slug: string, outcome?: "yes" | "no") => void;
  expandedSelection?: { slug: string; outcome: "yes" | "no" } | null;
  onExpand?: (slug: string, outcome: "yes" | "no") => void;
}) {
  const [selectedLineKey, setSelectedLineKey] = useState<string>();
  const lineOptions = useMemo(() => {
    const byKey = new Map<string, { key: string; value: number }>();
    for (const option of options) {
      const value = lineValue(option);
      byKey.set(lineKey(value), { key: lineKey(value), value });
    }
    return [...byKey.values()].sort((a, b) => a.value - b.value);
  }, [options]);

  useEffect(() => {
    if (lineOptions.length === 0) return;
    const selectedOption = options.find(
      (option) =>
        option.market.slug === selectedSlug &&
        (option.outcome ?? "yes") === selectedOutcome,
    );
    const nextKey =
      selectedLineKey && lineOptions.some((line) => line.key === selectedLineKey)
        ? selectedLineKey
        : selectedOption
          ? lineKey(lineValue(selectedOption))
          : lineOptions[0].key;
    if (selectedLineKey !== nextKey) setSelectedLineKey(nextKey);
  }, [lineOptions, options, selectedLineKey, selectedOutcome, selectedSlug]);

  const activeLineKey = selectedLineKey ?? lineOptions[0]?.key;
  if (!activeLineKey) return null;

  return (
    <div
      className="flex flex-col gap-2"
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button,a,input,select,textarea")) return;
        event.stopPropagation();
        const option =
          options.find((candidate) => lineKey(lineValue(candidate)) === activeLineKey) ??
          options[0];
        if (!option) return;
        const nextOutcome = option.outcome ?? "yes";
        onExpand?.(option.market.slug, nextOutcome);
        onInspect?.(option.market.slug, nextOutcome);
      }}
    >
      {label && (
        <div className="truncate text-xs font-medium text-zinc-400">
          {label}
        </div>
      )}
      <LineSelectorContent
        group={group}
        options={options}
        activeLineKey={activeLineKey}
        lineOptions={lineOptions}
        selectedSlug={selectedSlug}
        selectedOutcome={selectedOutcome}
        optionOdds={optionOdds}
        onSelect={onSelect}
        onInspect={onInspect}
        expandedSelection={expandedSelection}
        onExpand={onExpand}
        onLineChange={setSelectedLineKey}
      />
    </div>
  );
}

function buildSpreadTradeOptions(options: MarketOption[]): MarketOption[] {
  const home = options.find((option) => option.side === "home");
  const away = options.find((option) => option.side === "away");
  return [home, away].filter((option): option is MarketOption => Boolean(option));
}

function lineValue(option: MarketOption): number {
  return typeof option.line === "number" ? option.line : option.sort;
}

function lineKey(value: number): string {
  return value.toFixed(4);
}

function formatPlainLine(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatSignedLine(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${formatPlainLine(value)}`;
}

// The batch orderbook endpoint caps a request at 100 markets; chunk so the
// active tab's markets land in the first request.
const SEED_BATCH_SIZE = 100;

/**
 * Tracks the live YES best-ask for every open market of the match.
 *
 * All open markets (across category tabs) are subscribed at once and seeded via
 * REST with bounded concurrency, so switching tabs needs no fresh
 * subscribe/fetch — every market is already live and seeded. The selected
 * market is excluded from the WS subscription (its book is owned by
 * useRealtimeOrderbook / MobileTradeBar on the shared, un-ref-counted client)
 * and instead has its live price mirrored into the map via `selectedPrice`.
 */
function useVisibleOrderbookPrices(
  markets: MarketOption["market"][],
  selectedSlug?: string,
  selectedPrice?: number | null,
  prioritySlugs?: Set<string>,
): Map<string, number> {
  const predictClient = usePredictClient();
  const { wsClient } = usePredictWsClient();
  const [pricesBySlug, setPricesBySlug] = useState<Map<string, number>>(
    () => new Map(),
  );
  // Slugs already covered by a REST snapshot, so the seed only ever fetches a
  // market once.
  const seededSlugsRef = useRef<Set<string>>(new Set());

  // Content-addressed list of (slug, source) pairs to track. Sorting + the JSON
  // round-trip yields a referentially stable value that only changes when the
  // actual set of markets changes, not on every parent re-render.
  const subscribedMarketsKey = useMemo(() => {
    const list = markets
      .filter(
        (market) => market.status === "open" && market.slug !== selectedSlug,
      )
      .map((market) => ({
        slug: market.slug,
        source: (market.source ?? "polymarket") as ProviderSource,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
    return JSON.stringify(list);
  }, [markets, selectedSlug]);
  const subscribedMarkets = useMemo(
    () =>
      JSON.parse(subscribedMarketsKey) as {
        slug: string;
        source: ProviderSource;
      }[],
    [subscribedMarketsKey],
  );
  const subscribedSlugSet = useMemo(
    () => new Set(subscribedMarkets.map((market) => market.slug)),
    [subscribedMarkets],
  );

  // Latest valid-slug set, read by the long-lived WS listener so it does not
  // re-register on every selection/category change.
  const subscribedSlugSetRef = useRef(subscribedSlugSet);
  subscribedSlugSetRef.current = subscribedSlugSet;

  // REST seed: the server pushes no snapshot on subscribe, so fetch one for
  // every not-yet-seeded market to render before the first WS push (and as a
  // fallback when WS is down). A single batch request replaces the previous
  // per-market fan-out; markets in the active tab are placed in the first chunk
  // so they fill immediately while the rest stream in behind them. The seed
  // never overwrites a slug that already has a (fresher) WS value.
  useEffect(() => {
    const pending = subscribedMarkets.filter(
      (market) => !seededSlugsRef.current.has(market.slug),
    );
    if (pending.length === 0) return;
    pending.sort((a, b) => {
      const pa = prioritySlugs?.has(a.slug) ? 0 : 1;
      const pb = prioritySlugs?.has(b.slug) ? 0 : 1;
      return pa - pb;
    });

    let cancelled = false;

    const applySeed = (slug: string, price: number | null) => {
      seededSlugsRef.current.add(slug);
      if (cancelled || price == null || price <= 0) return;
      setPricesBySlug((prev) => {
        if (prev.has(slug)) return prev;
        const next = new Map(prev);
        next.set(slug, price);
        return next;
      });
    };

    const fetchChunk = async (
      chunk: { slug: string; source: ProviderSource }[],
    ) => {
      try {
        const results = await predictClient.getOrderbooks(
          chunk.map((market) => ({
            slug: market.slug,
            source: market.source,
            outcome: "yes" as const,
          })),
        );
        if (cancelled) return;
        const bySlug = new Map(results.map((result) => [result.slug, result]));
        for (const market of chunk) {
          const orderbook = bySlug.get(market.slug)?.orderbook;
          const price =
            orderbook &&
            orderbook.market_id === market.slug &&
            orderbook.outcome === "yes"
              ? pickBestAsk(orderbook, "yes")
              : null;
          applySeed(market.slug, price);
        }
      } catch {
        if (cancelled) return;
        for (const market of chunk) applySeed(market.slug, null);
      }
    };

    void (async () => {
      for (let i = 0; i < pending.length; i += SEED_BATCH_SIZE) {
        if (cancelled) return;
        await fetchChunk(pending.slice(i, i + SEED_BATCH_SIZE));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [predictClient, prioritySlugs, subscribedMarkets]);

  // Mirror the selected market's live best-ask into the same map so the panel
  // reads one price source for every market. This keeps the price continuous
  // when a market toggles between selected and visible, instead of briefly
  // dropping to the stale static snapshot.
  useEffect(() => {
    if (!selectedSlug || selectedPrice == null || selectedPrice <= 0) return;
    setPricesBySlug((prev) => {
      if (prev.get(selectedSlug) === selectedPrice) return prev;
      const next = new Map(prev);
      next.set(selectedSlug, selectedPrice);
      return next;
    });
  }, [selectedSlug, selectedPrice]);

  // Drop prices (and seed tracking) for markets that left the match's set. The
  // selected slug is retained even though it is excluded from the subscription,
  // so its last live price survives until it rejoins.
  useEffect(() => {
    seededSlugsRef.current.forEach((slug) => {
      if (!subscribedSlugSet.has(slug)) seededSlugsRef.current.delete(slug);
    });
    setPricesBySlug((prev) => {
      let changed = false;
      const next = new Map<string, number>();
      prev.forEach((price, slug) => {
        if (subscribedSlugSet.has(slug) || slug === selectedSlug) {
          next.set(slug, price);
          return;
        }
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [selectedSlug, subscribedSlugSet]);

  // Long-lived WS listener, registered once per client. Reads the valid-slug
  // set from a ref so it survives selection/category changes without
  // re-subscribing.
  useEffect(() => {
    if (!wsClient) return;
    return wsClient.on("orderbook", (msg: WsDataMessage<WsOrderbookEvent>) => {
      const slug = msg.data.market_slug;
      if (
        !subscribedSlugSetRef.current.has(slug) ||
        msg.data.outcome !== "yes"
      ) {
        return;
      }
      const orderbook: Orderbook = {
        market_id: slug,
        outcome: "yes",
        bids: msg.data.bids,
        asks: msg.data.asks,
        spread: msg.data.spread,
      };
      const ask = pickBestAsk(orderbook, "yes");
      setPricesBySlug((prev) => {
        if (ask == null || ask <= 0) {
          if (!prev.has(slug)) return prev;
          const next = new Map(prev);
          next.delete(slug);
          return next;
        }
        if (prev.get(slug) === ask) return prev;
        const next = new Map(prev);
        next.set(slug, ask);
        return next;
      });
    });
  }, [wsClient]);

  // Delta (un)subscribe: a selection or category change only toggles the slugs
  // that actually entered/left the set instead of re-subscribing every market.
  const wsSubscribedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!wsClient) return;
    const current = wsSubscribedRef.current;
    const added: string[] = [];
    const removed: string[] = [];
    subscribedSlugSet.forEach((slug) => {
      if (!current.has(slug)) added.push(slug);
    });
    current.forEach((slug) => {
      if (!subscribedSlugSet.has(slug)) removed.push(slug);
    });
    if (added.length > 0) wsClient.subscribe(["orderbook"], added);
    if (removed.length > 0) wsClient.unsubscribe(["orderbook"], removed);
    wsSubscribedRef.current = new Set(subscribedSlugSet);
  }, [subscribedSlugSet, wsClient]);

  // Tear down every subscription when the client changes or the panel unmounts.
  useEffect(() => {
    if (!wsClient) return;
    return () => {
      const all = Array.from(wsSubscribedRef.current);
      if (all.length > 0) wsClient.unsubscribe(["orderbook"], all);
      wsSubscribedRef.current = new Set();
    };
  }, [wsClient]);

  return pricesBySlug;
}

function GroupRow({
  group,
  options,
  selectedSlug,
  selectedOutcome,
  orderbookPricesBySlug,
  onSelect,
  onInspect,
  expandedSelection,
  onExpand,
  renderInlineOrderbook,
  label,
}: {
  group: MarketGroup;
  options: MarketOption[];
  selectedSlug: string;
  selectedOutcome: "yes" | "no";
  orderbookPricesBySlug: Map<string, number>;
  onSelect: (slug: string, outcome?: "yes" | "no") => void;
  onInspect?: (slug: string, outcome?: "yes" | "no") => void;
  expandedSelection?: { slug: string; outcome: "yes" | "no" } | null;
  onExpand?: (slug: string, outcome: "yes" | "no") => void;
  renderInlineOrderbook?: (slug: string, outcome: "yes" | "no") => ReactNode;
  label: string;
}) {
  const { t } = useTranslation();
  const firstHalfPrefix = String(t("extend.worldcup.firstHalfPrefix"));
  const secondHalfPrefix = String(t("extend.worldcup.secondHalfPrefix"));
  const [format] = useOddsFormat();
  const [selectedLineKey, setSelectedLineKey] = useState<string>();

  const isLineSelectorGroup = LINE_SELECTOR_TYPES.has(group.type);
  const isTeamTotalsGroup = TEAM_TOTAL_SELECTOR_TYPES.has(group.type);
  const isExactScoreGroup = group.type === "soccer_exact_score";
  const isItemBinaryListGroup = ITEM_BINARY_LIST_TYPES.has(group.type);
  const isBinaryOutcomeGroup =
    BINARY_OUTCOME_TYPES.has(group.type) ||
    BINARY_OUTCOME_TYPES.has(group.type_label) ||
    group.key.includes("btts");
  const binaryOutcomeLabels = useMemo(
    () =>
      group.type === "soccer_game_corners_odd_even" ||
      group.type_label === "soccer_game_corners_odd_even"
        ? {
            yes: t("extend.worldcup.cornerSide.odd"),
            no: t("extend.worldcup.cornerSide.even"),
          }
        : {
            yes: t("extend.worldcup.detail.trade.yes"),
            no: t("extend.worldcup.detail.trade.no"),
          },
    [group.type, group.type_label, t],
  );
  const renderedOptions = useMemo<MarketOption[]>(
    () =>
      isBinaryOutcomeGroup && options[0]
        ? [
            {
              ...(options.find((option) => option.outcome === "yes") ?? options[0]),
              label: binaryOutcomeLabels.yes,
              outcome: "yes",
            },
            {
              ...(options.find((option) => option.outcome === "no") ?? options[0]),
              label: binaryOutcomeLabels.no,
              outcome: "no",
            },
          ]
        : options,
    [binaryOutcomeLabels, isBinaryOutcomeGroup, options],
  );
  const lineOptions = useMemo(() => {
    const byKey = new Map<string, { key: string; value: number }>();
    for (const option of renderedOptions) {
      const value = lineValue(option);
      byKey.set(lineKey(value), { key: lineKey(value), value });
    }
    return [...byKey.values()].sort((a, b) => a.value - b.value);
  }, [renderedOptions]);

  useEffect(() => {
    if (!isLineSelectorGroup || lineOptions.length === 0) return;
    const selectedOption = renderedOptions.find(
      (option) =>
        option.market.slug === selectedSlug &&
        (option.outcome ?? "yes") === selectedOutcome,
    );
    const nextKey =
      selectedLineKey && lineOptions.some((line) => line.key === selectedLineKey)
        ? selectedLineKey
        : selectedOption
          ? lineKey(lineValue(selectedOption))
          : lineOptions[0].key;
    if (selectedLineKey !== nextKey) setSelectedLineKey(nextKey);
  }, [
    isLineSelectorGroup,
    lineOptions,
    renderedOptions,
    selectedLineKey,
    selectedOutcome,
    selectedSlug,
  ]);

  if (options.length === 0) return null;

  const activeLineKey = selectedLineKey ?? lineOptions[0]?.key;
  const inspectFirstOption = () => {
    const option =
      isLineSelectorGroup && activeLineKey
        ? renderedOptions.find(
            (candidate) => lineKey(lineValue(candidate)) === activeLineKey,
          ) ?? renderedOptions[0]
        : renderedOptions[0];
    if (!option) return;
    const nextOutcome = option.outcome ?? "yes";
    onExpand?.(option.market.slug, nextOutcome);
    onInspect?.(option.market.slug, nextOutcome);
  };
  const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        "button,a,input,select,textarea,[data-market-orderbook]",
      )
    ) {
      return;
    }
    inspectFirstOption();
  };
  const handleTradeSelect = (
    event: MouseEvent<HTMLButtonElement>,
    slug: string,
    nextOutcome?: "yes" | "no",
  ) => {
    event.stopPropagation();
    const resolvedOutcome = nextOutcome ?? "yes";
    if (expandedSelection) onExpand?.(slug, resolvedOutcome);
    onSelect(slug, resolvedOutcome);
  };
  const single = renderedOptions.length === 1;
  // Option odds use each market's live YES best-ask (mirrored into the map for
  // the selected market too) so they line up with the order book. An open
  // market whose first live price has not arrived yet shows nothing: the static
  // snapshot drifts from the live book, so flashing it would make the price
  // visibly jump once the real value loads. Closed markets keep their static
  // settled price as the only available value.
  const optionOdds = (option: MarketOption): string | null => {
    const optionOutcome = option.outcome ?? "yes";
    if (optionOutcome === "yes") {
      const live = orderbookPricesBySlug.get(option.market.slug);
      const livePrice = displayableBuyPrice(live);
      if (livePrice !== null) return convertPrice(livePrice, format);
      if (option.market.status === "open") return null;
    }
    const displayPrice = displayableBuyPrice(
      optionOutcome === "yes"
        ? yesAskPrice(option.market)
        : option.market.outcomes?.[1]?.best_ask ?? option.market.outcomes?.[1]?.price,
    );
    return displayPrice === null ? null : convertPrice(displayPrice, format);
  };

  return (
    <div
      className="border-b border-zinc-800/60 pb-3 last:border-b-0 last:pb-0"
      onClick={renderInlineOrderbook ? handleRowClick : undefined}
    >
      {!isExactScoreGroup && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-sm font-medium text-zinc-100">
              {label}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
              {formatVolume(group.volume)} {t("extend.worldcup.volume")}
            </span>
          </div>
        </div>
      )}

      {isExactScoreGroup || isItemBinaryListGroup ? (
        <ExactScoreContent
          options={renderedOptions}
          selectedSlug={selectedSlug}
          selectedOutcome={selectedOutcome}
          optionOdds={optionOdds}
          onSelect={onSelect}
          onInspect={onInspect}
          expandedSelection={expandedSelection}
          onExpand={onExpand}
        />
      ) : isTeamTotalsGroup ? (
        <TeamTotalsContent
          group={group}
          options={renderedOptions}
          selectedSlug={selectedSlug}
          selectedOutcome={selectedOutcome}
          optionOdds={optionOdds}
          onSelect={onSelect}
          onInspect={onInspect}
          expandedSelection={expandedSelection}
          onExpand={onExpand}
        />
      ) : isLineSelectorGroup && activeLineKey ? (
        <LineSelectorContent
          group={group}
          options={renderedOptions}
          activeLineKey={activeLineKey}
          lineOptions={lineOptions}
          selectedSlug={selectedSlug}
          selectedOutcome={selectedOutcome}
          optionOdds={optionOdds}
          onSelect={onSelect}
          onInspect={onInspect}
          expandedSelection={expandedSelection}
          onExpand={onExpand}
          onLineChange={setSelectedLineKey}
        />
      ) : single ? (
        (() => {
          const odds = optionOdds(renderedOptions[0]);
          return (
            <button
              type="button"
              onClick={(event) =>
                handleTradeSelect(
                  event,
                  renderedOptions[0].market.slug,
                  renderedOptions[0].outcome,
                )
              }
              className={cn(
                "flex w-full flex-col items-center justify-center gap-1 rounded-[8px] border px-3 py-2 text-center transition-colors cursor-pointer",
                renderedOptions[0].market.slug === selectedSlug &&
                  (renderedOptions[0].outcome ?? "yes") === selectedOutcome
                  ? "border-[#c7ff2e]/60 bg-[#c7ff2e]/10 text-[#c7ff2e]"
                  : "border-zinc-700/60 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100",
              )}
            >
              <span className="min-w-0 max-w-full truncate text-xs font-medium leading-tight">
                {marketButtonLabel(
                  renderedOptions[0],
                  group,
                  firstHalfPrefix,
                  secondHalfPrefix,
                )}
              </span>
              <span className="text-sm font-bold leading-tight tabular-nums text-bearish">
                {odds ?? "-"}
              </span>
            </button>
          );
        })()
      ) : (
        <div className={cn("grid gap-1.5", isBinaryOutcomeGroup ? "grid-cols-2" : "grid-cols-3")}>
          {renderedOptions.map((o) => {
            const selected =
              o.market.slug === selectedSlug && (o.outcome ?? "yes") === selectedOutcome;
            const odds = optionOdds(o);
            return (
              <button
                key={`${o.market.slug}:${o.outcome ?? "yes"}`}
                type="button"
                onClick={(event) => handleTradeSelect(event, o.market.slug, o.outcome)}
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center gap-1 rounded-[8px] border px-2 py-2 text-center transition-colors cursor-pointer",
                  selected
                    ? "border-[#c7ff2e]/60 bg-[#c7ff2e]/10 text-[#c7ff2e]"
                    : "border-zinc-700/60 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100",
                )}
              >
                <span className="max-w-full truncate text-xs font-medium leading-tight">
                  {marketButtonLabel(o, group, firstHalfPrefix, secondHalfPrefix)}
                </span>
                <span className="text-sm font-bold leading-tight tabular-nums text-bearish">
                  {odds ?? "-"}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <AnimatePresence initial={false}>
        {expandedSelection && renderInlineOrderbook && (
          <motion.div
            key={`${expandedSelection.slug}:${expandedSelection.outcome}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
            data-market-orderbook
          >
            <div className="pt-3">
              {renderInlineOrderbook(
                expandedSelection.slug,
                expandedSelection.outcome,
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
