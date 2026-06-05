"use client";

import { useMemo, useState } from "react";
import { cn } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import { formatVolume } from "../util";
import {
  type CategorizedMarkets,
  type MarketCategory,
  type MarketGroup,
  type MarketOption,
  yesPrice,
} from "./marketGrouping";

type SortKey = "default" | "odds" | "volume" | "liquidity";

const SORTS: SortKey[] = ["default", "odds", "volume", "liquidity"];

/**
 * future.news-style Markets switcher. Lets the user browse every market type of
 * a match (Game Lines / Exact Score / Halftime Result), filter to active
 * markets, re-sort, and pick a specific outcome/line — which drives the chart,
 * order book, trade panel and header of the detail page.
 */
export function MarketsPanel({
  cats,
  activeCategory,
  selectedSlug,
  onSelect,
  onClose,
  className,
}: {
  cats: CategorizedMarkets;
  activeCategory: MarketCategory;
  selectedSlug: string;
  onSelect: (slug: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const { t } = useTranslation();

  const [sort, setSort] = useState<SortKey>("default");
  const [activeOnly, setActiveOnly] = useState(false);
  const [category, setCategory] = useState<MarketCategory>(activeCategory);

  const categoryTabs = useMemo(
    () =>
      (
        [
          ["gameLines", cats.gameLines],
          ["exactScore", cats.exactScore],
          ["halftime", cats.halftime],
        ] as [MarketCategory, MarketGroup[]][]
      ).filter(([, groups]) => groups.length > 0),
    [cats],
  );

  const groups = useMemo<MarketGroup[]>(() => {
    switch (category) {
      case "exactScore":
        return cats.exactScore;
      case "halftime":
        return cats.halftime;
      default:
        return cats.gameLines;
    }
  }, [cats, category]);

  const sortOptions = (options: MarketOption[]): MarketOption[] => {
    const filtered = activeOnly
      ? options.filter((o) => o.market.status === "open")
      : options;
    if (sort === "default") return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sort) {
        case "odds":
          return yesPrice(b.market) - yesPrice(a.market);
        case "volume":
          return (b.market.volume ?? 0) - (a.market.volume ?? 0);
        case "liquidity":
          return (b.market.liquidity ?? 0) - (a.market.liquidity ?? 0);
        default:
          return 0;
      }
    });
    return copy;
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-[12px] border border-zinc-800 bg-zinc-900/40",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
        <span className="text-sm font-semibold text-zinc-100">
          {t("extend.worldcup.detail.markets.title")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Sort + active-only */}
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 px-3 py-2">
        {SORTS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={cn(
              "rounded-[7px] px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
              sort === key
                ? "bg-zinc-800 text-[#c7ff2e]"
                : "text-zinc-500 hover:text-zinc-200",
            )}
          >
            {t(`extend.worldcup.detail.markets.sort.${key}`)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setActiveOnly((v) => !v)}
          className={cn(
            "ml-auto rounded-[7px] border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
            activeOnly
              ? "border-[#c7ff2e]/50 bg-[#c7ff2e]/10 text-[#c7ff2e]"
              : "border-zinc-700/60 text-zinc-400 hover:text-zinc-200",
          )}
        >
          {t("extend.worldcup.detail.markets.activeOnly")}
        </button>
      </div>

      {/* Category tabs */}
      {categoryTabs.length > 1 && (
        <div className="flex items-center gap-1 border-b border-zinc-800 px-3 py-2">
          {categoryTabs.map(([key]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                "rounded-[8px] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
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
            options={sortOptions(group.options)}
            selectedSlug={selectedSlug}
            onSelect={onSelect}
            label={t(`extend.worldcup.detail.markets.type.${group.type_label}`)}
          />
        ))}
      </div>
    </div>
  );
}

function GroupRow({
  group,
  options,
  selectedSlug,
  onSelect,
  label,
}: {
  group: MarketGroup;
  options: MarketOption[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
  label: string;
}) {
  const { t } = useTranslation();

  if (options.length === 0) return null;

  // The probability shown on the right is the selected option's (or the first
  // option's) YES price, mirroring future.news.
  const active =
    options.find((o) => o.market.slug === selectedSlug) ?? options[0];
  const prob = Math.round(yesPrice(active.market) * 100);
  const single = options.length === 1;

  return (
    <div className="rounded-[10px] border border-zinc-800/70 bg-zinc-900/40 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-medium text-zinc-100">{label}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
            {formatVolume(group.volume)} {t("extend.worldcup.volume")}
          </span>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-[#c7ff2e]">
          {prob}%
        </span>
      </div>

      {single ? (
        <button
          type="button"
          onClick={() => onSelect(options[0].market.slug)}
          className={cn(
            "w-full rounded-[8px] border px-2.5 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer",
            options[0].market.slug === selectedSlug
              ? "border-[#c7ff2e]/60 bg-[#c7ff2e]/10 text-[#c7ff2e]"
              : "border-zinc-700/60 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100",
          )}
        >
          {options[0].label}
        </button>
      ) : (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {options.map((o) => {
            const selected = o.market.slug === selectedSlug;
            return (
              <button
                key={o.market.slug}
                type="button"
                onClick={() => onSelect(o.market.slug)}
                className={cn(
                  "shrink-0 rounded-[8px] border px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors cursor-pointer",
                  selected
                    ? "border-[#c7ff2e]/60 bg-[#c7ff2e]/10 text-[#c7ff2e]"
                    : "border-zinc-700/60 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
