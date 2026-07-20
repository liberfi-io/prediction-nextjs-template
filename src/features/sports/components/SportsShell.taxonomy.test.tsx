import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SportsShell } from "./SportsShell";

jest.mock("@liberfi.io/ui", () => {
  const actual = jest.requireActual("@liberfi.io/ui");
  const TestContainer = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );

  return {
    ...actual,
    StyledModal: ({
      children,
      isOpen,
      placement,
      size,
    }: {
      children: ReactNode;
      isOpen: boolean;
      placement?: string;
      size?: string;
    }) =>
      isOpen ? (
        <div role="dialog" data-placement={placement} data-size={size}>
          {children}
        </div>
      ) : null,
    ModalContent: TestContainer,
    ModalHeader: TestContainer,
    ModalBody: TestContainer,
  };
});

jest.mock("../i18n/LocalizedTaxonomyLabel", () => ({
  LocalizedTaxonomyLabel: ({ node }: { node: { slug: string } }) => (
    <span data-testid="localized-taxonomy-label">{node.slug}</span>
  ),
}));

const mobileTaxonomyScrollCases = [
  ["default live view", {}, "live"],
  ["proposals view", { view: "proposals" as const }, "proposals"],
  ["top-level taxonomy", { sport_slug: "soccer" }, "soccer"],
  [
    "nested taxonomy",
    { sport_slug: "soccer", league_slug: "epl" },
    "soccer",
  ],
] as const;

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

  it("renders navigation groups and keeps counts off special links", () => {
    const { container } = render(
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
    for (const link of screen.getAllByRole("link", {
      name: /filters\.(live|proposals)/i,
    })) {
      expect(link.textContent).not.toMatch(/\d/);
    }
    const liveIcons = container.querySelectorAll(
      '[data-sports-navigation-icon="live"]',
    );
    expect(liveIcons).toHaveLength(2);
    expect(
      Array.from(liveIcons).every((icon) =>
        icon.classList.contains("text-bearish"),
      ),
    ).toBe(true);
    expect(
      container.querySelectorAll(
        '[data-sports-navigation-icon="live"][data-animated="true"]',
      ),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll('[data-sports-navigation-icon="proposals"]'),
    ).toHaveLength(2);
    expect(screen.getByText(/filters\.featured/i)).toBeDefined();
    expect(screen.getAllByText("5")).toHaveLength(1);
    expect(screen.getAllByText("13")).toHaveLength(2);
    const mobileTaxonomyLink = container.querySelector(
      '[data-taxonomy-scroll-target="soccer"]',
    );
    expect(mobileTaxonomyLink).not.toBeNull();
    expect(
      mobileTaxonomyLink?.querySelector('img[src*="soccer.svg"]'),
    ).not.toBeNull();
    expect(
      mobileTaxonomyLink?.querySelector(".text-\\[11px\\]")?.textContent,
    ).toBe("13");
    const navigationGroups = container.querySelector(".divide-y");
    expect(navigationGroups?.classList.contains("divide-zinc-800")).toBe(true);
    expect(navigationGroups?.children).toHaveLength(3);
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

  it("keeps the mobile taxonomy modal open while navigating taxonomy", () => {
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
                  },
                ],
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

    fireEvent.click(
      screen.getByRole("button", { name: /extend\.sports\.nav\.sports/i }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.dataset.placement).toBe("bottom");
    expect(dialog.dataset.size).toBe("lg");
    expect(
      within(dialog).getByText(/extend\.sports\.filters\.allSportsEvents/i),
    ).toBeDefined();
    expect(
      within(dialog).queryByRole("link", { name: /filters\.live/i }),
    ).toBeNull();
    expect(
      within(dialog).queryByRole("link", { name: /filters\.proposals/i }),
    ).toBeNull();
    expect(within(dialog).getByText(/filters\.featured/i)).toBeDefined();
    expect(within(dialog).getByText(/nav\.sports/i)).toBeDefined();

    fireEvent.click(within(dialog).getByRole("link", { name: /soccer/i }));

    expect(screen.getByRole("dialog")).toBe(dialog);
    fireEvent.click(within(dialog).getByRole("link", { name: /epl/i }));
    expect(screen.getByRole("dialog")).toBe(dialog);
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

  it.each(mobileTaxonomyScrollCases)(
    "scrolls the mobile taxonomy strip for %s",
    (_label, filters, expectedTarget) => {
      const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
      const scrollIntoView = jest.fn();
      const getBoundingClientRect = jest
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: HTMLElement) {
          const target = this.dataset.taxonomyScrollTarget;
          if (target === expectedTarget) {
            return { left: 320, right: 400 } as DOMRect;
          }
          return { left: 0, right: 300 } as DOMRect;
        });
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: scrollIntoView,
      });

      try {
        render(
          <SportsShell
            section="sports"
            filters={{ ...filters }}
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
                        slug: "basketball",
                        label: "Basketball",
                      },
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

        expect(scrollIntoView).toHaveBeenCalledWith({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
        expect(
          (scrollIntoView.mock.instances[0] as HTMLElement).dataset
            .taxonomyScrollTarget,
        ).toBe(expectedTarget);
      } finally {
        getBoundingClientRect.mockRestore();
        if (originalScrollIntoView) {
          Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
            configurable: true,
            value: originalScrollIntoView,
          });
        } else {
          delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
        }
      }
    },
  );

  it("keeps the selected mobile taxonomy pill in place when fully visible", () => {
    const scrollIntoView = jest.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const getBoundingClientRect = jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ left: 0, right: 300 } as DOMRect);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    try {
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
                    },
                  ],
                },
              ],
            },
          }}
        />,
      );

      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      getBoundingClientRect.mockRestore();
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
          configurable: true,
          value: originalScrollIntoView,
        });
      } else {
        delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
      }
    }
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
