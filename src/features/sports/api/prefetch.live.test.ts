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

    const result = await prefetchSportsPageData({
      section: "sports",
      lang: "zh-Hant",
      deadline,
      filters: { view: "live" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requestedUrls = fetchMock.mock.calls.map(
      ([value]) => new URL(String(value)),
    );
    const matchesUrl = requestedUrls.find(
      (url) => url.pathname === "/api/v1/sports/matches",
    );
    const countsUrl = requestedUrls.find(
      (url) =>
        url.pathname === "/api/v1/sports/matches/taxonomy-counts",
    );
    expect(matchesUrl?.searchParams.get("start_time_gte")).toBe(
      "2026-07-23T00:00:00Z",
    );
    expect(matchesUrl?.searchParams.get("start_time_lt")).toBe(
      "2026-07-30T00:00:00Z",
    );
    expect(matchesUrl?.searchParams.has("view")).toBe(false);
    expect(countsUrl?.searchParams.get("start_time_gte")).toBe(
      "2026-07-23T00:00:00Z",
    );
    expect(countsUrl?.searchParams.get("start_time_lt")).toBe(
      "2026-07-30T00:00:00Z",
    );
    expect(countsUrl?.searchParams.has("status")).toBe(false);
    expect(result.match_taxonomy_counts).toEqual([]);
  });

  it("uses the live range preserved by taxonomy navigation", async () => {
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
      filters: {
        view: "live",
        taxonomy_type: "sport",
        taxonomy_slug: "soccer",
        start_time_gte: "2026-07-30T00:00:00Z",
        start_time_lt: "2026-08-06T00:00:00Z",
      },
    });

    const urls = fetchMock.mock.calls.map(
      ([value]) => new URL(String(value)),
    );
    expect(
      urls.every(
        (url) =>
          url.searchParams.get("start_time_gte") ===
            "2026-07-30T00:00:00Z" &&
          url.searchParams.get("start_time_lt") ===
            "2026-08-06T00:00:00Z",
      ),
    ).toBe(true);
  });
});
