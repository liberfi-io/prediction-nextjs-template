import { fireEvent, render, screen } from "@testing-library/react";
import { SportsShell } from "./SportsShell";

jest.mock("../i18n/LocalizedTaxonomyLabel", () => ({
  LocalizedTaxonomyLabel: ({ node }: { node: { slug: string } }) => (
    <span data-testid="localized-taxonomy-label">{node.slug}</span>
  ),
}));

describe("SportsShell taxonomy labels", () => {
  it("uses the shared localized label at mobile and rail entry points", () => {
    render(
      <SportsShell
        section="sports"
        filters={{}}
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
        }}
      />,
    );

    expect(screen.getAllByTestId("localized-taxonomy-label")).toHaveLength(2);
  });

  it("renders special, featured, and full taxonomy groups with counts", () => {
    render(
      <SportsShell
        section="sports"
        filters={{}}
        data={{
          matches: [],
          props: [],
          taxonomy: {
            sections: [
              {
                section: "sports",
                featured: [
                  {
                    section: "sports",
                    node_type: "league",
                    slug: "mlb",
                    label: "MLB",
                    counts: {
                      match_count: 5,
                      prop_count: 0,
                      total_count: 5,
                    },
                  },
                ],
                children: [
                  {
                    section: "sports",
                    node_type: "sport",
                    slug: "soccer",
                    label: "Soccer",
                    counts: {
                      match_count: 10,
                      prop_count: 3,
                      total_count: 13,
                    },
                  },
                ],
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getAllByRole("link", { name: /live/i })).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: /filters\.proposals/i }),
    ).toHaveLength(2);
    expect(screen.getByText(/filters\.featured/i)).toBeDefined();
    expect(screen.getAllByText("5")).toHaveLength(1);
    expect(screen.getAllByText("13")).toHaveLength(2);
  });

  it("does not render zero navigation counts", () => {
    render(
      <SportsShell
        section="esports"
        filters={{}}
        data={{
          matches: [],
          props: [],
          taxonomy: {
            sections: [
              {
                section: "esports",
                children: [
                  {
                    section: "esports",
                    node_type: "sport",
                    slug: "cs2",
                    label: "Counter-Strike 2",
                    counts: {
                      match_count: 0,
                      prop_count: 0,
                      total_count: 0,
                    },
                  },
                ],
              },
            ],
          },
        }}
      />,
    );

    expect(screen.queryByText("0")).toBeNull();
  });

  it("navigates to the parent when a child is selected", () => {
    render(
      <SportsShell
        section="sports"
        filters={{ sport_slug: "soccer", league_slug: "epl" }}
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

    const parentLinks = screen.getAllByRole("link", { name: /soccer/i });
    const desktopParentLink = parentLinks.find(
      (link) =>
        link.getAttribute("href") === "/sports?sport_slug=soccer" &&
        link.classList.contains("h-8"),
    );

    expect(desktopParentLink).toBeDefined();
    expect(desktopParentLink?.classList.contains("bg-content1")).toBe(false);
    expect(
      desktopParentLink?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      ),
    ).toBe(true);
  });

  it("toggles expansion instead of navigating when the parent is selected", () => {
    render(
      <SportsShell
        section="sports"
        filters={{ sport_slug: "soccer" }}
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

    const parentLinks = screen.getAllByRole("link", { name: /soccer/i });
    const desktopParentLink = parentLinks.find((link) =>
      link.classList.contains("bg-content1"),
    );

    expect(desktopParentLink).toBeDefined();
    screen.getByRole("link", { name: /epl/i });
    fireEvent.click(desktopParentLink as HTMLElement);
    expect(screen.queryByRole("link", { name: /epl/i })).toBeNull();
  });
});
