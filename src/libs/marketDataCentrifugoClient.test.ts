import {
  createMarketDataCentrifugoTransportFactory,
  type CentrifugoClientLike,
  type CentrifugoSubscriptionLike,
} from "./marketDataCentrifugoClient";

class FakeSubscription implements CentrifugoSubscriptionLike {
  readonly listeners = new Map<string, Set<(context: unknown) => void>>();
  subscribe = jest.fn();
  unsubscribe = jest.fn();

  on(event: string, listener: (context: unknown) => void) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  emit(event: string, context: unknown) {
    this.listeners.get(event)?.forEach((listener) => listener(context));
  }
}

class FakeClient implements CentrifugoClientLike {
  readonly subscriptions = new Map<string, FakeSubscription>();
  connect = jest.fn();
  disconnect = jest.fn();
  removeSubscription = jest.fn();

  newSubscription(channel: string) {
    const subscription = new FakeSubscription();
    this.subscriptions.set(channel, subscription);
    return subscription;
  }
}

describe("market data Centrifugo transport", () => {
  it("forwards recovery acknowledgement and ordered publications", () => {
    const client = new FakeClient();
    const factory = createMarketDataCentrifugoTransportFactory({
      endpoint: "wss://example.test/connection/websocket",
      createClient: () => client,
    });
    const transport = factory();
    const onSubscribed = jest.fn();
    const onPublication = jest.fn();
    const onError = jest.fn();

    transport.subscribe("event.channel", {
      onSubscribed,
      onPublication,
      onError,
    });
    const subscription = client.subscriptions.get("event.channel")!;
    subscription.emit("subscribed", {
      recovered: true,
      streamPosition: { epoch: "epoch-2", offset: 41 },
    });
    subscription.emit("publication", { data: { sequence: 1 }, offset: 42 });
    subscription.emit("publication", {
      data: JSON.stringify({ sequence: 2 }),
      offset: 43,
    });

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(onSubscribed).toHaveBeenCalledWith({
      epoch: "epoch-2",
      offset: 41,
      recovered: true,
    });
    expect(onPublication.mock.calls).toEqual([
      [{ data: { sequence: 1 }, epoch: "epoch-2", offset: 42 }],
      [{ data: { sequence: 2 }, epoch: "epoch-2", offset: 43 }],
    ]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports malformed JSON without forwarding a publication", () => {
    const client = new FakeClient();
    const transport = createMarketDataCentrifugoTransportFactory({
      endpoint: "wss://example.test/connection/websocket",
      createClient: () => client,
    })();
    const onPublication = jest.fn();
    const onError = jest.fn();

    transport.subscribe("event.channel", {
      onSubscribed: jest.fn(),
      onPublication,
      onError,
    });
    client.subscriptions.get("event.channel")!.emit("publication", {
      data: "{not-json",
      offset: 1,
    });

    expect(onPublication).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("closes the live gate while reconnecting and forwards the new epoch ack", () => {
    const client = new FakeClient();
    const transport = createMarketDataCentrifugoTransportFactory({
      endpoint: "wss://example.test/connection/websocket",
      createClient: () => client,
    })();
    const onSubscribed = jest.fn();
    const onError = jest.fn();

    transport.subscribe("event.channel", {
      onSubscribed,
      onPublication: jest.fn(),
      onError,
    });
    const subscription = client.subscriptions.get("event.channel")!;
    subscription.emit("subscribing", { code: 1 });
    subscription.emit("subscribed", {
      recovered: false,
      streamPosition: { epoch: "epoch-3", offset: 0 },
    });

    expect(onError).toHaveBeenCalledWith({
      code: "centrifugo_subscribing",
      context: { code: 1 },
    });
    expect(onSubscribed).toHaveBeenCalledWith({
      epoch: "epoch-3",
      offset: 0,
      recovered: false,
    });
  });

  it("makes unsubscribe idempotent and ignores late events", () => {
    const client = new FakeClient();
    const transport = createMarketDataCentrifugoTransportFactory({
      endpoint: "wss://example.test/connection/websocket",
      createClient: () => client,
    })();
    const onPublication = jest.fn();
    const handle = transport.subscribe("event.channel", {
      onSubscribed: jest.fn(),
      onPublication,
      onError: jest.fn(),
    });
    const subscription = client.subscriptions.get("event.channel")!;

    handle.unsubscribe();
    handle.unsubscribe();
    subscription.emit("publication", { data: {}, offset: 1 });
    transport.close?.();

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(client.removeSubscription).toHaveBeenCalledTimes(1);
    expect(onPublication).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });
});
