"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  cn,
  EmptyIcon,
  Skeleton,
  Spinner,
  useDynamicRowHeight,
  VirtualList,
  type VirtualRowComponentProps,
} from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";
import { useWorldcupFeeds } from "../../../data/queries";
import type { WcFeed } from "../../../types";
import { FeedItem } from "./FeedItem";

const DEFAULT_HEIGHT = 404;
const ESTIMATED_ROW_HEIGHT = 180;
/** Trigger fetching the next page this many rows before the end. */
const LOAD_MORE_THRESHOLD = 4;

export interface MarketNewsWidgetProps {
  /** Match (event) slug; feeds are scoped to it once the upstream supports it. */
  slug: string;
  className?: string;
}

/**
 * Virtualised, infinite-scrolling market-news feed for a World Cup match.
 *
 * Visuals/interactions benchmark `@liberfi.io/ui-media-track` (tweet cards),
 * while the windowed list mirrors `ui-predict`'s comments widget: a
 * `VirtualList` (react-window) with dynamic row heights and a viewport-driven
 * `onRowsRendered` hook that pages through the cursor-based API.
 */
export function MarketNewsWidget({ slug, className }: MarketNewsWidgetProps) {
  const { t } = useTranslation();

  const {
    data,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useWorldcupFeeds(slug);

  const feeds = useMemo<WcFeed[]>(
    () => data?.pages?.flatMap((p) => p.items) ?? [],
    [data?.pages],
  );

  // Measure available height so the windowed list fills the panel.
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      if (h > 0) setMeasuredHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const listHeight = measuredHeight || DEFAULT_HEIGHT;

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: ESTIMATED_ROW_HEIGHT,
    key: slug,
  });

  const itemCount = feeds.length;
  const rowCount = itemCount + (hasNextPage ? 1 : 0);

  const onRowsRendered = useCallback(
    (visible: { startIndex: number; stopIndex: number }) => {
      if (
        hasNextPage &&
        !isFetchingNextPage &&
        visible.stopIndex >= itemCount - LOAD_MORE_THRESHOLD
      ) {
        void fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, itemCount, fetchNextPage],
  );

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      <div className="min-h-0 flex-auto" ref={containerRef}>
        {isLoading ? (
          <FeedsSkeleton />
        ) : isError ? (
          <FeedsState message={t("extend.worldcup.detail.news.error")} />
        ) : feeds.length === 0 ? (
          <FeedsState message={t("extend.worldcup.detail.news.empty")} />
        ) : (
          <VirtualList
            className="no-scrollbar"
            style={{ height: listHeight }}
            onRowsRendered={onRowsRendered}
            rowComponent={FeedRow}
            rowCount={rowCount}
            rowHeight={rowHeight}
            rowProps={{ feeds, itemCount }}
            overscanCount={4}
          />
        )}
      </div>
    </div>
  );
}

interface FeedRowData {
  feeds: WcFeed[];
  itemCount: number;
}

function FeedRow({
  index,
  style,
  feeds,
  itemCount,
}: VirtualRowComponentProps<FeedRowData>): ReactElement | null {
  if (index >= itemCount) {
    return (
      <div style={style} className="flex items-center justify-center py-4">
        <Spinner size="sm" />
      </div>
    );
  }

  const feed = feeds[index];
  if (!feed) return null;

  // Do NOT set a fixed height; the list measures the rendered card.
  return (
    <div style={style} className="pb-2.5">
      <FeedItem feed={feed} />
    </div>
  );
}

function FeedsSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-2.5 rounded-[10px] border border-zinc-800 bg-zinc-900/40 p-3"
        >
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedsState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center py-16">
      <EmptyIcon width={28} height={28} className="text-zinc-600" />
      <p className="mt-2 text-sm text-zinc-500">{message}</p>
    </div>
  );
}
