/** @jest-environment node */
import { getEventsMarketDataHydration } from "../features/market-data/server";
import { prefetchSportsPageData } from "../features/sports/api/prefetch";
import { getServerPredictClient } from "./server/predictClient";
import { pollTransaction } from "../lib/polymarket-relay";

jest.mock("./server/predictClient", () => ({ getServerPredictClient: jest.fn() }));
const originalFetch = global.fetch;
const originalKey = process.env.PREDICT_API_KEY;
const originalUrl = process.env.PREDICT_URL;
beforeEach(() => {
  process.env.PREDICT_API_KEY = "self-key";
  process.env.PREDICT_URL = "https://predict.test";
});
afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.PREDICT_API_KEY; else process.env.PREDICT_API_KEY = originalKey;
  if (originalUrl === undefined) delete process.env.PREDICT_URL; else process.env.PREDICT_URL = originalUrl;
});

test("market-data SSR authenticates direct native fetch", async () => {
  const mocked = jest.fn().mockResolvedValue({ ok: false });
  global.fetch = mocked;
  await getEventsMarketDataHydration({ enabled: true, params: {}, requestHeaders: { "Accept-Language": "zh" } });
  const headers = new Headers(mocked.mock.calls[0][1].headers);
  expect(headers.get("x-api-key")).toBe("self-key");
  expect(headers.get("accept-language")).toBe("zh");
});

test("sports SSR authenticates its direct match and prop requests", async () => {
  jest.mocked(getServerPredictClient).mockReturnValue({ getSportsTaxonomy: jest.fn().mockResolvedValue(null) } as never);
  const mocked = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
  global.fetch = mocked;
  await prefetchSportsPageData({ section: "sports", lang: "en", deadline: {
    deadlineAt: Number.MAX_SAFE_INTEGER, remainingMs: () => 10000,
    withRemainingTimeout: (op) => op(new AbortController().signal),
  } });
  expect(mocked).toHaveBeenCalled();
  for (const call of mocked.mock.calls) expect(new Headers(call[1].headers).get("x-api-key")).toBe("self-key");
});

test("wallet relay status uses the constrained service endpoint", async () => {
  const mocked = jest.fn().mockResolvedValue({ ok: true, json: async () => [{ state: "STATE_CONFIRMED", transactionHash: "0xabc" }] });
  global.fetch = mocked;
  await pollTransaction({ signProxyUrl: "https://app.test/predict-api/api/v1/polymarket/sign" }, "tx", ["STATE_CONFIRMED"], "STATE_FAILED", 1, 0);
  const [url, options] = mocked.mock.calls[0];
  expect(url).toBe("https://app.test/predict-api/api/v1/polymarket/relay");
  expect(JSON.parse(options.body)).toEqual({ method: "GET", path: "/transaction?id=tx", body: "" });
  expect(new Headers(options.headers).get("x-api-key")).toBe("self-key");
});
