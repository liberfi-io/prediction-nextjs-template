import { getServerPredictClient } from "../../../libs/server/predictClient";
import type { SportsSsrDeadline } from "../route/sportsSsrDeadline";
import { prefetchSportsPageData } from "./prefetch";

jest.mock("../../../libs/server/predictClient", () => ({
  getServerPredictClient: jest.fn(),
}));

const deadline: SportsSsrDeadline = {
  deadlineAt: Number.MAX_SAFE_INTEGER,
  remainingMs: () => 10_000,
  withRemainingTimeout: (op) => op(new AbortController().signal),
};

describe("live sports prefetch", () => {
  const originalPredictUrl = process.env.PREDICT_URL;

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete (global as { fetch?: typeof fetch }).fetch;
    process.env.PREDICT_URL = originalPredictUrl;
  });

  it("requests only matches in the current seven-day UTC range", async () => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date("2026-07-23T00:30:00Z"));
    process.env.PREDICT_URL = "https://predict.example/";
    jest.mocked(getServerPredictClient).mockReturnValue({
      getSportsTaxonomy: jest.fn().mockResolvedValue(null),
    } as never);
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    global.fetch = fetchMock;

    await prefetchSportsPageData({
      section: "sports",
      lang: "zh-Hant",
      deadline,
      filters: { view: "live" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe("/api/v1/sports/matches");
    expect(requestedUrl.searchParams.get("start_time_gte")).toBe(
      "2026-07-23T00:00:00Z",
    );
    expect(requestedUrl.searchParams.get("start_time_lt")).toBe(
      "2026-07-30T00:00:00Z",
    );
    expect(requestedUrl.searchParams.has("view")).toBe(false);
  });
});
