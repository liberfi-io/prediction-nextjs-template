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
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
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

  it("renders the date range and first-level taxonomy switches", async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        next_cursor: null,
        has_more: false,
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

      fireEvent.click(
        within(datePicker).getByTestId("sports-live-date-2026-07-25"),
      );
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
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const nextWeekUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
      expect(nextWeekUrl.searchParams.get("start_time_gte")).toBe(
        "2026-07-30T00:00:00Z",
      );
      expect(nextWeekUrl.searchParams.get("start_time_lt")).toBe(
        "2026-08-06T00:00:00Z",
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
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      const previousWeekButton = within(datePicker).getByRole("button", {
        name: "extend.sports.filters.previousWeek",
      }) as HTMLButtonElement;
      expect(previousWeekButton.disabled).toBe(true);
      fireEvent.click(previousWeekButton);
      expect(fetchMock).toHaveBeenCalledTimes(2);
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
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

      const taxonomySwitch = screen.getByTestId("sports-live-taxonomy-switch");
      expect(within(taxonomySwitch).getByText("12")).toBeDefined();
      const soccerLink = within(taxonomySwitch)
        .getByText("soccer")
        .closest("a");
      expect(soccerLink?.getAttribute("href")).toBe(
        "/sports?view=live&taxonomy_type=sport&taxonomy_slug=soccer",
      );
      expect(soccerLink?.getAttribute("aria-current")).toBe("page");
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
