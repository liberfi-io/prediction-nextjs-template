import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { SportsShell } from "./SportsShell";
import {
  formatSportsLiveDateRange,
  matchesForUtcDate,
  SportsLiveFilters,
} from "./SportsLiveFilters";

jest.mock("../i18n/LocalizedTaxonomyLabel", () => ({
  LocalizedTaxonomyLabel: ({ node }: { node: { slug: string } }) => (
    <span data-testid="localized-taxonomy-label">{node.slug}</span>
  ),
}));

jest.mock("../../worldcup/odds/OddsNumber", () => ({
  OddsNumber: ({ value }: { value: string | number }) => <span>{value}</span>,
}));

describe("SportsShell live filters", () => {
  it("keeps date-level taxonomy selection out of the primary navigation", () => {
    const { container } = render(
      <SportsShell
        section="sports"
        filters={{}}
        lang="en"
        data={{
          matches: [],
          props: [],
          taxonomy: {
            sections: [
              {
                section: "sports",
                children: [
                  {
                    section: "sports",
                    node_type: "sport",
                    slug: "soccer",
                    label: "Soccer",
                    counts: {
                      match_count: 3,
                      prop_count: 0,
                      total_count: 3,
                    },
                    children: [
                      {
                        section: "sports",
                        node_type: "league",
                        slug: "epl",
                        label: "Premier League",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }}
      />,
    );

    fireEvent.click(
      within(screen.getByTestId("sports-live-taxonomy-switch")).getByRole(
        "link",
        { name: /soccer/i },
      ),
    );

    const primarySoccerLinks = container.querySelectorAll(
      'a[href="/sports?taxonomy_type=sport&taxonomy_slug=soccer"]',
    );
    expect(primarySoccerLinks.length).toBeGreaterThan(0);
    expect(
      Array.from(primarySoccerLinks).every(
        (link) =>
          !link.classList.contains("bg-content1") &&
          !link.classList.contains("bg-bullish/10"),
      ),
    ).toBe(true);
    expect(screen.queryByText("epl")).toBeNull();
  });

  it("keeps the selected taxonomy option visible", () => {
    const scrollBy = jest.fn();
    const originalScrollBy = HTMLElement.prototype.scrollBy;
    const getBoundingClientRect = jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("overflow-x-auto")) {
          return { left: 0, right: 300 } as DOMRect;
        }
        if (this.getAttribute("aria-current") === "page") {
          return { left: 320, right: 400 } as DOMRect;
        }
        return { left: 0, right: 0 } as DOMRect;
      });
    Object.defineProperty(HTMLElement.prototype, "scrollBy", {
      configurable: true,
      value: scrollBy,
    });
    const soccer = {
      section: "sports" as const,
      node_type: "sport" as const,
      slug: "soccer",
      label: "Soccer",
    };
    const tennis = {
      section: "sports" as const,
      node_type: "sport" as const,
      slug: "tennis",
      label: "Tennis",
    };
    const sharedProps = {
      section: "sports" as const,
      dates: [new Date("2026-07-23T00:00:00Z")],
      selectedDate: new Date("2026-07-23T00:00:00Z"),
      timeRange: {
        start_time_gte: "2026-07-23T00:00:00Z",
        start_time_lt: "2026-07-24T00:00:00Z",
      },
      liveRangeStart: "2026-07-23T00:00:00Z",
      lang: "en",
      onDateChange: jest.fn(),
      onToday: jest.fn(),
      previousWeekDisabled: true,
      onPreviousWeek: jest.fn(),
      onNextWeek: jest.fn(),
      onTaxonomyNavigate: jest.fn(() => true),
      onAllNavigate: jest.fn(),
    };

    try {
      const { rerender } = render(
        <SportsLiveFilters
          {...sharedProps}
          taxonomyItems={[
            { node: soccer, active: true, count: 12 },
            { node: tennis, active: false, count: 8 },
          ]}
        />,
      );

      expect(scrollBy).toHaveBeenLastCalledWith({
        behavior: "auto",
        left: 132,
      });
      expect(
        scrollBy.mock.instances
          .at(-1)
          ?.querySelector('a[aria-current="page"]')
          ?.getAttribute("href"),
      ).toContain("taxonomy_slug=soccer");

      rerender(
        <SportsLiveFilters
          {...sharedProps}
          taxonomyItems={[
            { node: soccer, active: false, count: 12 },
            { node: tennis, active: true, count: 8 },
          ]}
        />,
      );

      expect(
        scrollBy.mock.instances
          .at(-1)
          ?.querySelector('a[aria-current="page"]')
          ?.getAttribute("href"),
      ).toContain("taxonomy_slug=tennis");

      const callsBeforeCountUpdate = scrollBy.mock.calls.length;
      rerender(
        <SportsLiveFilters
          {...sharedProps}
          taxonomyItems={[
            { node: soccer, active: false, count: 12000 },
            { node: tennis, active: true, count: 8 },
          ]}
        />,
      );
      expect(scrollBy.mock.calls.length).toBeGreaterThan(
        callsBeforeCountUpdate,
      );

      rerender(
        <SportsLiveFilters
          {...sharedProps}
          taxonomyItems={[
            { node: soccer, active: false, count: 12000 },
            { node: tennis, active: false, count: 8 },
          ]}
        />,
      );
      expect(
        scrollBy.mock.instances
          .at(-1)
          ?.querySelector('a[aria-current="page"]')
          ?.getAttribute("href"),
      ).not.toContain("taxonomy_slug");
    } finally {
      getBoundingClientRect.mockRestore();
      if (originalScrollBy) {
        Object.defineProperty(HTMLElement.prototype, "scrollBy", {
          configurable: true,
          value: originalScrollBy,
        });
      } else {
        delete (HTMLElement.prototype as Partial<HTMLElement>).scrollBy;
      }
    }
  });

  it("only includes years when the live range crosses a calendar year", () => {
    expect(
      formatSportsLiveDateRange(
        [
          new Date("2026-07-23T00:00:00Z"),
          new Date("2026-07-29T00:00:00Z"),
        ],
        "en",
      ),
    ).toBe("Jul 23 – Jul 29");
    expect(
      formatSportsLiveDateRange(
        [
          new Date("2026-12-29T00:00:00Z"),
          new Date("2027-01-04T00:00:00Z"),
        ],
        "en",
      ),
    ).toBe("Dec 29, 2026 – Jan 4, 2027");
  });

  it("filters matches by the selected UTC calendar day", () => {
    const selectedDate = new Date("2026-07-23T00:00:00Z");
    const selectedMatch = {
      match_group_slug: "selected",
      section: "sports" as const,
      title: "Selected",
      start_time: "2026-07-23T20:00:00Z",
    };
    const nextDateMatch = {
      ...selectedMatch,
      match_group_slug: "next-date",
      title: "Next date",
      start_time: "2026-07-24T10:00:00Z",
    };

    expect(
      matchesForUtcDate([selectedMatch, nextDateMatch], selectedDate),
    ).toEqual([selectedMatch]);
  });

  it("restores the selected date and visible range from navigation filters", async () => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date("2026-07-23T00:30:00Z"));
    const data = {
      matches: [],
      props: [],
      taxonomy: null,
      match_taxonomy_counts: [],
    };
    try {
      const { rerender } = render(
        <SportsShell
          section="sports"
          filters={{
            view: "live",
            start_time_gte: "2026-07-24T00:00:00Z",
            start_time_lt: "2026-07-25T00:00:00Z",
            live_range_start: "2026-07-23T00:00:00Z",
          }}
          lang="en"
          data={data}
        />,
      );

      expect(
        screen
          .getByTestId("sports-live-date-2026-07-24")
          .getAttribute("aria-current"),
      ).toBe("date");
      rerender(
        <SportsShell
          section="sports"
          filters={{
            view: "live",
            start_time_gte: "2026-07-30T00:00:00Z",
            start_time_lt: "2026-07-31T00:00:00Z",
            live_range_start: "2026-07-30T00:00:00Z",
          }}
          lang="en"
          data={data}
        />,
      );

      await waitFor(() =>
        expect(
          screen
            .getByTestId("sports-live-date-2026-07-30")
            .getAttribute("aria-current"),
        ).toBe("date"),
      );
      expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
        "Jul 30",
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("commits live date and taxonomy selections before requests resolve", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(
      (_input: RequestInfo | URL) => new Promise<Response>(() => undefined),
    );
    global.fetch = fetchMock;
    jest
      .useFakeTimers()
      .setSystemTime(new Date("2026-07-23T00:30:00Z"));

    try {
      render(
        <SportsShell
          section="sports"
          filters={{ view: "live" }}
          lang="en"
          data={{
            matches: [],
            props: [],
            taxonomy: {
              sections: [
                {
                  section: "sports",
                  children: [
                    {
                      section: "sports",
                      node_type: "sport",
                      slug: "soccer",
                      label: "Soccer",
                    },
                  ],
                },
              ],
            },
            match_taxonomy_counts: [
              {
                taxonomy_type: "sport",
                taxonomy_slug: "soccer",
                match_count: 7,
              },
            ],
          }}
        />,
      );

      const datePicker = screen.getByTestId("sports-live-date-picker");
      fireEvent.click(
        within(datePicker).getByTestId("sports-live-date-2026-07-24"),
      );
      expect(
        within(datePicker)
          .getByTestId("sports-live-date-2026-07-24")
          .getAttribute("aria-current"),
      ).toBe("date");
      expect(
        document.querySelector('[data-sports-list-loading="true"]'),
      ).not.toBeNull();

      fireEvent.click(
        within(datePicker).getByRole("button", {
          name: "extend.worldcup.tab.today",
        }),
      );
      expect(
        within(datePicker)
          .getByTestId("sports-live-date-2026-07-23")
          .getAttribute("aria-current"),
      ).toBe("date");

      const taxonomySwitch = screen.getByTestId(
        "sports-live-taxonomy-switch",
      );
      const soccerLink = within(taxonomySwitch).getByRole("link", {
        name: /soccer/i,
      });
      fireEvent.click(soccerLink);

      expect(soccerLink.getAttribute("aria-current")).toBe("page");
      expect(
        within(taxonomySwitch)
          .getByRole("link", { name: "extend.sports.filters.all" })
          .getAttribute("aria-current"),
      ).toBeNull();
      expect(
        document.querySelector('[data-sports-list-loading="true"]'),
      ).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(5);
      const taxonomyRequest = new URL(
        String(fetchMock.mock.calls[4]?.[0]),
        "http://localhost",
      );
      expect(taxonomyRequest.pathname).toContain("/sports/matches");
      expect(taxonomyRequest.searchParams.get("taxonomy_type")).toBe("sport");
      expect(taxonomyRequest.searchParams.get("taxonomy_slug")).toBe("soccer");
      expect(taxonomyRequest.searchParams.get("start_time_gte")).toBe(
        "2026-07-23T00:00:00Z",
      );
      expect(taxonomyRequest.searchParams.get("start_time_lt")).toBe(
        "2026-07-24T00:00:00Z",
      );

      const allLink = within(taxonomySwitch).getByRole("link", {
        name: "extend.sports.filters.all",
      });
      fireEvent.click(allLink);
      expect(allLink.getAttribute("aria-current")).toBe("page");
      expect(soccerLink.getAttribute("aria-current")).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(6);
      const allRequest = new URL(
        String(fetchMock.mock.calls[5]?.[0]),
        "http://localhost",
      );
      expect(allRequest.searchParams.has("taxonomy_type")).toBe(false);
      expect(allRequest.searchParams.has("taxonomy_slug")).toBe(false);
    } finally {
      jest.useRealTimers();
      global.fetch = originalFetch;
    }
  });

  it("ignores a stale live cursor response after switching weeks", async () => {
    const originalFetch = global.fetch;
    let resolveOldPage: (value: unknown) => void = () => undefined;
    const oldPage = new Promise((resolve) => {
      resolveOldPage = resolve;
    });
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => oldPage)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
          has_more: false,
          next_cursor: null,
          limit: 20,
        }),
      });
    global.fetch = fetchMock;
    jest
      .useFakeTimers()
      .setSystemTime(new Date("2026-07-23T00:30:00Z"));

    try {
      render(
        <SportsShell
          section="sports"
          filters={{ view: "live" }}
          lang="en"
          data={{
            matches: [],
            props: [],
            taxonomy: null,
            match_pagination: {
              has_more: true,
              next_cursor: "old-week-cursor",
              limit: 20,
            },
          }}
        />,
      );

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      fireEvent.click(
        screen.getByRole("button", {
          name: "extend.sports.filters.nextWeek",
        }),
      );
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
      await waitFor(() =>
        expect(
          screen.getByText("extend.sports.empty.matches"),
        ).toBeDefined(),
      );

      await act(async () => {
        resolveOldPage({
          ok: true,
          json: async () => ({
            items: [
              {
                match_group_slug: "stale-old-week",
                section: "sports",
                title: "Stale old week match",
                start_time: "2026-07-30T13:00:00Z",
              },
            ],
            has_more: false,
            next_cursor: null,
            limit: 20,
          }),
        });
        await Promise.resolve();
      });

      expect(screen.queryByText("Stale old week match")).toBeNull();
      expect(screen.getByText("extend.sports.empty.matches")).toBeDefined();
    } finally {
      jest.useRealTimers();
      global.fetch = originalFetch;
    }
  });

  it("updates taxonomy counts when switching live weeks", async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname.endsWith("/taxonomy-counts")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                taxonomy_type: "sport",
                taxonomy_slug: "soccer",
                match_count: 3,
              },
              {
                taxonomy_type: "sport",
                taxonomy_slug: "tennis",
                match_count: 4,
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [],
          has_more: false,
          next_cursor: null,
          limit: 20,
        }),
      });
    });
    global.fetch = fetchMock;
    jest
      .useFakeTimers()
      .setSystemTime(new Date("2026-07-23T00:30:00Z"));

    try {
      render(
        <SportsShell
          section="sports"
          filters={{ view: "live" }}
          lang="en"
          data={{
            matches: [],
            props: [],
            taxonomy: {
              sections: [
                {
                  section: "sports",
                  children: [
                    {
                      section: "sports",
                      node_type: "sport",
                      slug: "soccer",
                      label: "Soccer",
                      counts: {
                        match_count: 99,
                        prop_count: 0,
                        total_count: 99,
                      },
                    },
                    {
                      section: "sports",
                      node_type: "sport",
                      slug: "tennis",
                      label: "Tennis",
                      counts: {
                        match_count: 88,
                        prop_count: 0,
                        total_count: 88,
                      },
                    },
                  ],
                },
              ],
            },
            match_taxonomy_counts: [
              {
                taxonomy_type: "sport",
                taxonomy_slug: "soccer",
                match_count: 7,
              },
            ],
          }}
        />,
      );

      const taxonomySwitch = screen.getByTestId(
        "sports-live-taxonomy-switch",
      );
      expect(
        within(taxonomySwitch).getByRole("link", { name: /soccer/i })
          .textContent,
      ).toContain("7");
      expect(
        within(taxonomySwitch).queryByRole("link", { name: /tennis/i }),
      ).toBeNull();

      fireEvent.click(
        screen.getByRole("button", {
          name: "extend.sports.filters.nextWeek",
        }),
      );

      await waitFor(() =>
        expect(
          within(taxonomySwitch).getByRole("link", { name: /soccer/i })
            .textContent,
        ).toContain("3"),
      );
      expect(
        within(taxonomySwitch).getByRole("link", { name: /tennis/i })
          .textContent,
      ).toContain("4");
      expect(
        within(taxonomySwitch)
          .getByRole("link", { name: /soccer/i })
          .getAttribute("href"),
      ).toContain(
        "start_time_gte=2026-07-30T00%3A00%3A00Z&start_time_lt=2026-07-31T00%3A00%3A00Z",
      );
      const requestedUrls = fetchMock.mock.calls.map(
        ([value]) => new URL(String(value), "http://localhost"),
      );
      expect(
        requestedUrls.some(
          (url) =>
            url.pathname.endsWith("/taxonomy-counts") &&
            url.searchParams.get("start_time_gte") ===
              "2026-07-30T00:00:00Z" &&
            url.searchParams.get("start_time_lt") ===
              "2026-07-31T00:00:00Z",
        ),
      ).toBe(true);
    } finally {
      jest.useRealTimers();
      global.fetch = originalFetch;
    }
  });

  it("keeps successful taxonomy counts when the date match request fails", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname.endsWith("/taxonomy-counts")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                taxonomy_type: "sport",
                taxonomy_slug: "soccer",
                match_count: 3,
              },
            ],
          }),
        });
      }
      return Promise.reject(new Error("match request failed"));
    });
    jest
      .useFakeTimers()
      .setSystemTime(new Date("2026-07-23T00:30:00Z"));

    try {
      render(
        <SportsShell
          section="sports"
          filters={{ view: "live" }}
          lang="en"
          data={{
            matches: [],
            props: [],
            taxonomy: {
              sections: [
                {
                  section: "sports",
                  children: [
                    {
                      section: "sports",
                      node_type: "sport",
                      slug: "soccer",
                      label: "Soccer",
                    },
                  ],
                },
              ],
            },
            match_taxonomy_counts: [
              {
                taxonomy_type: "sport",
                taxonomy_slug: "soccer",
                match_count: 7,
              },
            ],
          }}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "extend.sports.filters.nextWeek",
        }),
      );
      await waitFor(() =>
        expect(
          within(
            screen.getByTestId("sports-live-taxonomy-switch"),
          ).getByRole("link", { name: /soccer/i }).textContent,
        ).toContain("3"),
      );
    } finally {
      jest.useRealTimers();
      global.fetch = originalFetch;
    }
  });

  it("keeps the selected date counts when a taxonomy request supersedes its match request", async () => {
    const originalFetch = global.fetch;
    let resolveTaxonomyCounts: (value: Response) => void = () => undefined;
    const taxonomyCountsResponse = new Promise<Response>((resolve) => {
      resolveTaxonomyCounts = resolve;
    });
    const fetchMock = jest.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname.endsWith("/taxonomy-counts")) {
        return taxonomyCountsResponse;
      }
      if (url.searchParams.get("taxonomy_slug") === "soccer") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [],
            has_more: false,
            next_cursor: null,
            limit: 20,
          }),
        });
      }
      return new Promise<Response>(() => undefined);
    });
    global.fetch = fetchMock;
    jest
      .useFakeTimers()
      .setSystemTime(new Date("2026-07-23T00:30:00Z"));

    try {
      render(
        <SportsShell
          section="sports"
          filters={{ view: "live" }}
          lang="en"
          data={{
            matches: [],
            props: [],
            taxonomy: {
              sections: [
                {
                  section: "sports",
                  children: [
                    {
                      section: "sports",
                      node_type: "sport",
                      slug: "soccer",
                      label: "Soccer",
                    },
                  ],
                },
              ],
            },
            match_taxonomy_counts: [
              {
                taxonomy_type: "sport",
                taxonomy_slug: "soccer",
                match_count: 7,
              },
            ],
          }}
        />,
      );

      fireEvent.click(
        screen.getByTestId("sports-live-date-2026-07-24"),
      );
      const taxonomySwitch = screen.getByTestId(
        "sports-live-taxonomy-switch",
      );
      fireEvent.click(
        within(taxonomySwitch).getByRole("link", { name: /soccer/i }),
      );

      await act(async () => {
        resolveTaxonomyCounts({
          ok: true,
          json: async () => ({
            items: [
              {
                taxonomy_type: "sport",
                taxonomy_slug: "soccer",
                match_count: 3,
              },
            ],
          }),
        } as Response);
        await taxonomyCountsResponse;
      });

      await waitFor(() =>
        expect(
          within(taxonomySwitch).getByRole("link", { name: /soccer/i })
            .textContent,
        ).toContain("3"),
      );
      const taxonomyRequest = fetchMock.mock.calls
        .map(([value]) => new URL(String(value), "http://localhost"))
        .find((url) => url.searchParams.get("taxonomy_slug") === "soccer");
      expect(taxonomyRequest?.searchParams.get("start_time_gte")).toBe(
        "2026-07-24T00:00:00Z",
      );
    } finally {
      jest.useRealTimers();
      global.fetch = originalFetch;
    }
  });

  it("renders the date range and first-level taxonomy switches", async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      return Promise.resolve({
        ok: true,
        json: async () =>
          url.pathname.endsWith("/taxonomy-counts")
            ? {
                items: [
                  {
                    taxonomy_type: "sport",
                    taxonomy_slug: "soccer",
                    match_count: 12,
                  },
                  {
                    taxonomy_type: "sport",
                    taxonomy_slug: "tennis",
                    match_count: 1,
                  },
                ],
              }
            : {
                items: [],
                next_cursor: null,
                has_more: false,
                limit: 20,
              },
      });
    });
    global.fetch = fetchMock;
    jest
      .useFakeTimers()
      .setSystemTime(new Date("2026-07-23T00:30:00Z"));
    try {
      const { container } = render(
        <SportsShell
          section="sports"
          filters={{
            view: "live",
            taxonomy_type: "sport",
            taxonomy_slug: "soccer",
          }}
          lang="en"
          data={{
            matches: [],
            props: [],
            taxonomy: {
              sections: [
                {
                  section: "sports",
                  children: [
                    {
                      section: "sports",
                      node_type: "sport",
                      slug: "soccer",
                      label: "Soccer",
                      counts: {
                        match_count: 12,
                        prop_count: 0,
                        total_count: 12,
                      },
                    },
                    {
                      section: "sports",
                      node_type: "sport",
                      slug: "tennis",
                      label: "Tennis",
                    },
                  ],
                },
              ],
            },
          }}
        />,
      );

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading.textContent).toContain("extend.sports.filters.live");
      expect(heading.textContent).toContain("Jul 23");
      expect(heading.textContent).toContain("Jul 29");
      expect(heading.textContent).not.toContain("2026");

      const datePicker = screen.getByTestId("sports-live-date-picker");
      expect(within(datePicker).getAllByRole("button")).toHaveLength(10);
      expect(datePicker.className).toContain("overflow-hidden");
      expect(datePicker.className).toContain("sm:max-w-[560px]");
      expect(
        screen.getByTestId("sports-live-date-grid").className,
      ).toContain("grid-cols-7");
      expect(
        within(datePicker)
          .getByTestId("sports-live-date-2026-07-23")
          .getAttribute("aria-current"),
      ).toBe("date");
      expect(
        (
          within(datePicker).getByRole("button", {
            name: "extend.sports.filters.previousWeek",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(
        within(datePicker).getByRole("button", {
          name: "extend.worldcup.tab.today",
        }).className,
      ).toContain("cursor-pointer");
      expect(within(datePicker).getByText("Thu").className).toContain(
        "whitespace-nowrap",
      );
      expect(heading.querySelector('[data-sports-navigation-icon="live"]')).not
        .toBeNull();
      const primarySoccerLinks = container.querySelectorAll(
        'a[href="/sports?taxonomy_type=sport&taxonomy_slug=soccer"]',
      );
      expect(primarySoccerLinks.length).toBeGreaterThan(0);
      expect(
        Array.from(primarySoccerLinks).every(
          (link) =>
            !link.classList.contains("bg-content1") &&
            !link.classList.contains("bg-bullish/10"),
        ),
      ).toBe(true);

      fireEvent.click(
        within(datePicker).getByTestId("sports-live-date-2026-07-25"),
      );
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      const selectedDateUrls = fetchMock.mock.calls.map(
        ([value]) => new URL(String(value)),
      );
      expect(
        selectedDateUrls.every(
          (url) =>
            url.searchParams.get("start_time_gte") ===
              "2026-07-25T00:00:00Z" &&
            url.searchParams.get("start_time_lt") ===
              "2026-07-26T00:00:00Z",
        ),
      ).toBe(true);
      const resetTaxonomySwitch = screen.getByTestId(
        "sports-live-taxonomy-switch",
      );
      expect(
        within(resetTaxonomySwitch)
          .getByRole("link", { name: "extend.sports.filters.all" })
          .getAttribute("aria-current"),
      ).toBe("page");
      expect(
        within(resetTaxonomySwitch)
          .getByRole("link", { name: /soccer/i })
          .getAttribute("aria-current"),
      ).toBeNull();
      expect(
        selectedDateUrls.every(
          (url) =>
            !url.searchParams.has("taxonomy_type") &&
            !url.searchParams.has("taxonomy_slug"),
        ),
      ).toBe(true);
      fireEvent.click(
        within(datePicker).getByRole("button", {
          name: "extend.sports.filters.nextWeek",
        }),
      );
      expect(heading.textContent).toContain("Jul 30");
      expect(heading.textContent).toContain("Aug 5");
      expect(
        within(datePicker)
          .getByTestId("sports-live-date-2026-07-30")
          .getAttribute("aria-current"),
      ).toBe("date");
      expect(
        document.querySelector('[data-sports-list-loading="true"]'),
      ).not.toBeNull();
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
      const nextWeekUrl = fetchMock.mock.calls
        .map(([value]) => new URL(String(value)))
        .find(
          (url) =>
            !url.pathname.endsWith("/taxonomy-counts") &&
            url.searchParams.get("start_time_gte") ===
              "2026-07-30T00:00:00Z",
        );
      expect(nextWeekUrl).toBeDefined();
      expect(nextWeekUrl?.searchParams.get("start_time_gte")).toBe(
        "2026-07-30T00:00:00Z",
      );
      expect(nextWeekUrl?.searchParams.get("start_time_lt")).toBe(
        "2026-07-31T00:00:00Z",
      );
      await waitFor(() =>
        expect(
          document.querySelector('[data-sports-list-loading="true"]'),
        ).toBeNull(),
      );

      fireEvent.click(
        within(datePicker).getByRole("button", {
          name: "extend.sports.filters.previousWeek",
        }),
      );
      expect(heading.textContent).toContain("Jul 23");
      expect(heading.textContent).toContain("Jul 29");
      expect(
        within(datePicker)
          .getByTestId("sports-live-date-2026-07-23")
          .getAttribute("aria-current"),
      ).toBe("date");
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
      const previousWeekButton = within(datePicker).getByRole("button", {
        name: "extend.sports.filters.previousWeek",
      }) as HTMLButtonElement;
      expect(previousWeekButton.disabled).toBe(true);
      fireEvent.click(previousWeekButton);
      expect(fetchMock).toHaveBeenCalledTimes(6);
      expect(heading.textContent).toContain("Jul 23");
      expect(heading.textContent).toContain("Jul 29");

      fireEvent.click(
        within(datePicker).getByTestId("sports-live-date-2026-07-25"),
      );
      fireEvent.click(
        within(datePicker).getByRole("button", {
          name: "extend.worldcup.tab.today",
        }),
      );
      expect(
        within(datePicker)
          .getByTestId("sports-live-date-2026-07-23")
          .getAttribute("aria-current"),
      ).toBe("date");
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(10));

      const taxonomySwitch = screen.getByTestId("sports-live-taxonomy-switch");
      expect(within(taxonomySwitch).getByText("12")).toBeDefined();
      const soccerLink = within(taxonomySwitch)
        .getByText("soccer")
        .closest("a");
      expect(soccerLink?.getAttribute("href")).toBe(
        "/sports?view=live&start_time_gte=2026-07-23T00%3A00%3A00Z&start_time_lt=2026-07-24T00%3A00%3A00Z&live_range_start=2026-07-23T00%3A00%3A00Z&taxonomy_type=sport&taxonomy_slug=soccer",
      );
      expect(
        within(taxonomySwitch).getByText("extend.worldcup.odds"),
      ).toBeDefined();
      expect(soccerLink?.className).toContain("px-3");
      expect(soccerLink?.getAttribute("aria-current")).toBeNull();
      expect(
        within(taxonomySwitch)
          .getByRole("link", { name: "extend.sports.filters.all" })
          .getAttribute("aria-current"),
      ).toBe("page");
      expect(
        fetchMock.mock.calls
          .map(([value]) => new URL(String(value)))
          .filter((url) => !url.pathname.endsWith("/taxonomy-counts"))
          .every(
            (url) =>
              !url.searchParams.has("taxonomy_type") &&
              !url.searchParams.has("taxonomy_slug"),
          ),
      ).toBe(true);
      expect(screen.getByTestId("sports-page-header").className).not.toContain(
        "border-b",
      );
      expect(screen.queryByTestId("sports-content-toolbar")).toBeNull();

      const tennisLink = within(taxonomySwitch)
        .getAllByTestId("localized-taxonomy-label")
        .find((label) => label.textContent === "tennis")
        ?.closest("a");
      expect(tennisLink).not.toBeNull();
      fireEvent.click(tennisLink!);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
        "extend.sports.filters.live",
      );
      expect(screen.getByTestId("sports-live-date-picker")).toBeDefined();
    } finally {
      jest.useRealTimers();
      global.fetch = originalFetch;
    }
  });
});
