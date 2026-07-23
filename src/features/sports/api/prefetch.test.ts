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

describe("prefetchSportsPageData", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as { fetch?: typeof fetch }).fetch;
  });

  it("reads esports taxonomy from the esports endpoint", async () => {
    const getSportsTaxonomy = jest.fn();
    const getEsportsTaxonomy = jest.fn().mockResolvedValue({
      sections: [{ section: "esports", children: [] }],
    });
    jest.mocked(getServerPredictClient).mockReturnValue({
      getSportsTaxonomy,
      getEsportsTaxonomy,
    } as never);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });

    const result = await prefetchSportsPageData({
      section: "esports",
      lang: "zh-Hant",
      deadline,
    });

    expect(getEsportsTaxonomy).toHaveBeenCalledWith({ lang: "zh-Hant" });
    expect(getSportsTaxonomy).not.toHaveBeenCalled();
    expect(result.taxonomy?.sections?.[0]?.section).toBe("esports");
  });

  it("forwards upcoming view and its requested time range", async () => {
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
        view: "upcoming",
        start_time_gte: "2026-07-24T00:00:00Z",
        start_time_lt: "2026-07-31T00:00:00Z",
      },
    });

    const urls = fetchMock.mock.calls.map(([value]) => new URL(String(value)));
    expect(urls).toHaveLength(2);
    expect(urls.every((url) => url.searchParams.get("view") === "upcoming")).toBe(
      true,
    );
    expect(
      urls.every(
        (url) =>
          url.searchParams.get("start_time_gte") ===
            "2026-07-24T00:00:00Z" &&
          url.searchParams.get("start_time_lt") ===
            "2026-07-31T00:00:00Z",
      ),
    ).toBe(true);
  });
});
