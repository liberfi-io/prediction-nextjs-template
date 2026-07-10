"use client";

export type CentrifugoJsonStatus = "connecting" | "live" | "offline";

export interface SubscribeCentrifugoJsonOptions {
  channel: string;
  onData: (data: unknown) => void;
  onStatus?: (status: CentrifugoJsonStatus) => void;
}

const DEFAULT_WS_URL = "ws://localhost:8003/connection/websocket?format=json";

function centrifugoURL(): string | null {
  return process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL || DEFAULT_WS_URL;
}

function send(ws: WebSocket, payload: unknown): void {
  ws.send(`${JSON.stringify(payload)}\n`);
}

export function subscribeCentrifugoJson({
  channel,
  onData,
  onStatus,
}: SubscribeCentrifugoJsonOptions): () => void {
  const url = centrifugoURL();
  if (!url || typeof WebSocket === "undefined") return () => {};

  let closed = false;
  let reconnectTimer: number | undefined;
  let ws: WebSocket | undefined;
  let attempt = 0;

  const connect = () => {
    onStatus?.("connecting");
    ws = new WebSocket(url);
    ws.onopen = () => {
      attempt = 0;
      if (!ws) return;
      send(ws, { id: 1, connect: {} });
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.id === 1 && msg.connect && ws?.readyState === WebSocket.OPEN) {
          send(ws, { id: 2, subscribe: { channel } });
          onStatus?.("live");
          return;
        }
        onData(msg.push?.pub?.data);
      } catch {
        // Ignore malformed realtime frames.
      }
    };
    ws.onclose = () => {
      if (closed) return;
      onStatus?.("offline");
      const delay = Math.min(1000 * 2 ** attempt, 15000);
      attempt += 1;
      reconnectTimer = window.setTimeout(connect, delay);
    };
    ws.onerror = () => {
      ws?.close();
    };
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    ws?.close();
  };
}
