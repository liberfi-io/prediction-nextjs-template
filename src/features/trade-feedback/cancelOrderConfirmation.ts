"use client";

import { createElement, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  ordersMultiQueryKey,
  ordersQueryKey,
  usePredictClient,
  type PredictOrdersResponse,
  type ProviderSource,
} from "@liberfi.io/react-predict";
import { toast } from "@liberfi.io/ui";

type ToastWithProgress = typeof toast & {
  progress: (options: {
    id?: string;
    message: ReactNode;
    duration?: number;
    progress?: boolean;
  }) => string;
  update: (
    id: string,
    options: {
      type?: "success" | "error" | "blank";
      message: ReactNode;
      duration?: number;
      progress?: boolean;
      action?: ReactNode;
    },
  ) => string;
};

export interface CancelOrderConfirmationMessages {
  submitted: string;
  completed: string;
  delayed: string;
}

type TranslateFn = (key: never, vars?: Record<string, unknown>) => string;
interface LocaleLike {
  language?: string;
  resolvedLanguage?: string;
}

export interface ConfirmCancelOrderInput {
  source: ProviderSource;
  user?: string;
  kalshiUser?: string;
  polymarketUser?: string;
  orderId: string;
  messages: CancelOrderConfirmationMessages;
  getOrdersHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

const OPEN_ORDER_STATUSES = new Set(["live", "open", "submitted", "pending"]);
const MAX_DURATION_MS = 30_000;
const FAST_INTERVAL_MS = 2_000;
const SLOW_INTERVAL_MS = 3_000;
const SLOW_AFTER_MS = 12_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dataContainsOpenOrder(data: unknown, orderId: string): boolean {
  if (!data || typeof data !== "object") return false;

  if (Array.isArray(data)) {
    return data.some((item) => dataContainsOpenOrder(item, orderId));
  }

  const record = data as Record<string, unknown>;
  if (record.id === orderId) {
    const status = typeof record.status === "string" ? record.status : "";
    return !status || OPEN_ORDER_STATUSES.has(status);
  }

  return Object.values(record).some((value) =>
    dataContainsOpenOrder(value, orderId),
  );
}

function normalizeOpenOrders(data: unknown): unknown {
  if (!data || typeof data !== "object") return [];
  const response = data as {
    orders?: Array<Record<string, unknown>>;
    items?: Array<Record<string, unknown>>;
  };

  return (response.orders ?? response.items ?? [])
    .filter((order) => {
      const status = typeof order.status === "string" ? order.status : "";
      return OPEN_ORDER_STATUSES.has(status);
    })
    .map((order) => ({
      id: order.id,
      source: order.source,
      status: order.status,
      side: order.side,
      outcome: order.outcome,
      price: order.price,
      originalSize: order.original_size,
      marketSlug:
        typeof order.market === "object" && order.market
          ? (order.market as Record<string, unknown>).slug
          : undefined,
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function serializeOpenOrders(data: unknown): string {
  return JSON.stringify(normalizeOpenOrders(data));
}

function hasOpenOrder(data: unknown, orderId: string): boolean {
  return dataContainsOpenOrder(data, orderId);
}

function getOrdersWalletSets(input: ConfirmCancelOrderInput) {
  const kalshi_user =
    input.kalshiUser ?? (input.source === "kalshi" ? input.user : undefined);
  const polymarket_user =
    input.polymarketUser ??
    (input.source === "polymarket" ? input.user : undefined);
  const sourceWallet =
    input.source === "kalshi"
      ? { kalshi_user: input.user, polymarket_user: undefined }
      : { kalshi_user: undefined, polymarket_user: input.user };
  const result: Array<{
    kalshi_user?: string;
    polymarket_user?: string;
  }> = [];

  if (input.user) {
    result.push(sourceWallet);
  }
  if (kalshi_user || polymarket_user) {
    const duplicate = result.some(
      (item) =>
        item.kalshi_user === kalshi_user &&
        item.polymarket_user === polymarket_user,
    );
    if (!duplicate) {
      result.push({ kalshi_user, polymarket_user });
    }
  }

  return result;
}

function removeOrderFromEnrichedCaches(
  queryClient: QueryClient,
  input: ConfirmCancelOrderInput,
): void {
  for (const wallets of getOrdersWalletSets(input)) {
    queryClient.setQueryData<PredictOrdersResponse>(
      ordersMultiQueryKey(wallets),
      (previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          orders: previous.orders.filter((order) => order.id !== input.orderId),
        };
      },
    );
  }
}

function CountdownLabel({ deadlineAt }: { deadlineAt: number }) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, deadlineAt - Date.now()),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingMs(Math.max(0, deadlineAt - Date.now()));
    }, 1_000);
    return () => clearInterval(timer);
  }, [deadlineAt]);

  return createElement(
    "span",
    { className: "predict-trade-toast-countdown" },
    `${Math.max(0, Math.ceil(remainingMs / 1000))}s`,
  );
}

function isChineseLocale(i18n?: LocaleLike): boolean {
  const language = i18n?.resolvedLanguage ?? i18n?.language ?? "";
  return language.toLowerCase().startsWith("zh");
}

function translateWithFallback(
  t: TranslateFn,
  key: string,
  fallback: string,
): string {
  const value = t(key as never);
  return value && value !== key ? value : fallback;
}

export function getCancelOrderConfirmationMessages(
  t: TranslateFn,
  i18n?: LocaleLike,
): CancelOrderConfirmationMessages {
  const fallback = isChineseLocale(i18n)
    ? {
        submitted: "您的取消请求已成功提交，正在确认结果",
        completed: "挂单已取消",
        delayed: "您的取消请求已成功提交，确认时间比预期稍长",
      }
    : {
        submitted: "Your cancel request was submitted. Confirming the result.",
        completed: "Order canceled",
        delayed:
          "Your cancel request was submitted. Confirmation is taking a little longer.",
      };

  return {
    submitted: translateWithFallback(
      t,
      "predict.trade.cancelSubmitted",
      fallback.submitted,
    ),
    completed: translateWithFallback(
      t,
      "predict.trade.cancelCompleted",
      fallback.completed,
    ),
    delayed: translateWithFallback(
      t,
      "predict.trade.cancelDelayed",
      fallback.delayed,
    ),
  };
}

export function useCancelOrderResultConfirmation(): (
  input: ConfirmCancelOrderInput,
) => Promise<void> {
  const queryClient = useQueryClient();
  const predictClient = usePredictClient();

  return useCallback(
    async (input: ConfirmCancelOrderInput) => {
      const { orderId, messages } = input;
      const progressToast = toast as ToastWithProgress;
      const id = `predict-cancel-order-${orderId}-${Date.now()}`;
      const deadlineAt = Date.now() + MAX_DURATION_MS;
      const params =
        input.user ? { source: input.source, wallet_address: input.user } : undefined;

      progressToast.progress({
        id,
        message: messages.submitted,
        duration: MAX_DURATION_MS,
        progress: true,
        action: createElement(CountdownLabel, { deadlineAt }),
      });

      const startedAt = Date.now();
      let baseline: string | undefined;

      while (Date.now() <= deadlineAt) {
        if (params) {
          const headers = await input.getOrdersHeaders?.();
          const data = await queryClient
            .fetchQuery({
              queryKey: ordersQueryKey(params),
              queryFn: () => predictClient.listOrders(params, headers),
              staleTime: 0,
            })
            .catch(() => undefined);

          if (data) {
            const current = serializeOpenOrders(data);
            if (!hasOpenOrder(data, orderId)) {
              removeOrderFromEnrichedCaches(queryClient, input);
              progressToast.update(id, {
                type: "success",
                message: messages.completed,
                duration: 5_000,
              });
              return;
            }
            if (baseline === undefined) {
              baseline = current;
            } else if (!hasOpenOrder(data, orderId) || current !== baseline) {
              removeOrderFromEnrichedCaches(queryClient, input);
              progressToast.update(id, {
                type: "success",
                message: messages.completed,
                duration: 5_000,
              });
              return;
            }
          }
        }

        const elapsed = Date.now() - startedAt;
        const waitMs =
          elapsed < SLOW_AFTER_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;
        await sleep(Math.min(waitMs, Math.max(0, deadlineAt - Date.now())));
      }

      progressToast.update(id, {
        type: "blank",
        message: messages.delayed,
        duration: 8_000,
      });
    },
    [predictClient, queryClient],
  );
}
