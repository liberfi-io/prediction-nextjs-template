import { Centrifuge } from "centrifuge";
import type {
  MarketDataTransport,
  MarketDataTransportFactory,
} from "@liberfi.io/react-predict";

type CentrifugoListener = (context: unknown) => void;

export interface CentrifugoSubscriptionLike {
  on(event: string, listener: CentrifugoListener): this;
  subscribe(): void;
  unsubscribe(): void;
}

export interface CentrifugoClientLike {
  newSubscription(
    channel: string,
    options?: { recoverable?: boolean; positioned?: boolean },
  ): CentrifugoSubscriptionLike;
  removeSubscription(subscription: CentrifugoSubscriptionLike): void;
  connect(): void;
  disconnect(): void;
}

export interface MarketDataCentrifugoOptions {
  endpoint: string;
  token?: string;
  getToken?: () => Promise<string>;
  createClient?: (
    endpoint: string,
    options: { token?: string; getToken?: () => Promise<string> },
  ) => CentrifugoClientLike;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function decodePublicationData(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return JSON.parse(value) as unknown;
}

class CentrifugoMarketDataTransport implements MarketDataTransport {
  private readonly subscriptions = new Set<() => void>();
  private closed = false;

  constructor(private readonly client: CentrifugoClientLike) {
    client.connect();
  }

  subscribe(
    channel: string,
    callbacks: Parameters<MarketDataTransport["subscribe"]>[1],
  ) {
    if (this.closed) {
      throw new Error("market data transport is closed");
    }

    const subscription = this.client.newSubscription(channel, {
      positioned: true,
      recoverable: true,
    });
    let active = true;
    let epoch = "";
    let hasSubscribed = false;

    subscription.on("subscribed", (value) => {
      if (!active) return;
      const context = record(value);
      const position = record(context.streamPosition);
      hasSubscribed = true;
      epoch = typeof position.epoch === "string" ? position.epoch : "";
      callbacks.onSubscribed({
        epoch,
        offset: typeof position.offset === "number" ? position.offset : 0,
        recovered: context.recovered === true,
      });
    });
    subscription.on("publication", (value) => {
      if (!active) return;
      try {
        const context = record(value);
        if (
          typeof context.offset !== "number" ||
          !Number.isFinite(context.offset)
        ) {
          throw new Error("Centrifugo publication offset is missing");
        }
        callbacks.onPublication({
          data: decodePublicationData(context.data),
          epoch,
          offset: context.offset,
        });
      } catch (error) {
        callbacks.onError(error);
      }
    });
    subscription.on("error", (value) => {
      if (!active) return;
      const context = record(value);
      callbacks.onError(context.error ?? value);
    });
    subscription.on("subscribing", (value) => {
      if (!active || !hasSubscribed) return;
      callbacks.onError({
        code: "centrifugo_subscribing",
        context: value,
      });
    });
    subscription.on("unsubscribed", (value) => {
      if (!active) return;
      callbacks.onError({
        code: "centrifugo_unsubscribed",
        context: value,
      });
    });
    subscription.subscribe();

    const unsubscribe = () => {
      if (!active) return;
      active = false;
      subscription.unsubscribe();
      this.client.removeSubscription(subscription);
      this.subscriptions.delete(unsubscribe);
    };
    this.subscriptions.add(unsubscribe);
    return { unsubscribe };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    Array.from(this.subscriptions).forEach((unsubscribe) => unsubscribe());
    this.client.disconnect();
  }
}

/**
 * Creates the thin Centrifugo adapter owned by the SDK market-data runtime.
 */
export function createMarketDataCentrifugoTransportFactory(
  options: MarketDataCentrifugoOptions,
): MarketDataTransportFactory {
  return () => {
    const client =
      options.createClient?.(options.endpoint, {
        token: options.token,
        getToken: options.getToken,
      }) ??
      (new Centrifuge(options.endpoint, {
        token: options.token ?? "",
        getToken: options.getToken,
      }) as unknown as CentrifugoClientLike);
    return new CentrifugoMarketDataTransport(client);
  };
}
