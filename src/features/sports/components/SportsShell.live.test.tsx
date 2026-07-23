import { fireEvent, render, screen, within } from "@testing-library/react";
import { SportsShell } from "./SportsShell";
import {
  formatSportsLiveDateRange,
  matchesForDate,
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
        [new Date(2026, 6, 23), new Date(2026, 6, 29)],
        "en",
      ),
    ).toBe("Jul 23 – Jul 29");
    expect(
      formatSportsLiveDateRange(
        [new Date(2026, 11, 29), new Date(2027, 0, 4)],
        "en",
      ),
    ).toBe("Dec 29, 2026 – Jan 4, 2027");
  });

  it("filters matches by the selected local calendar day", () => {
    const selectedDate = new Date(2026, 6, 23);
    const selectedMatch = {
      match_group_slug: "selected",
      section: "sports" as const,
      title: "Selected",
      start_time: new Date(2026, 6, 23, 20).toISOString(),
    };
    const nextDateMatch = {
      ...selectedMatch,
      match_group_slug: "next-date",
      title: "Next date",
      start_time: new Date(2026, 6, 24, 10).toISOString(),
    };

    expect(
      matchesForDate([selectedMatch, nextDateMatch], selectedDate),
    ).toEqual([selectedMatch]);
  });

  it("renders the date range and first-level taxonomy switches", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 23, 12));
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
      expect(within(datePicker).getAllByRole("button")).toHaveLength(7);
      expect(
        within(datePicker)
          .getByTestId("sports-live-date-2026-07-23")
          .getAttribute("aria-current"),
      ).toBe("date");

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
    }
  });
});
