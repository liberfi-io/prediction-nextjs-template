import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import {
  findActiveMatchGroupIndex,
  matchesForToday,
  resolvePrimarySportsMarkets,
  sportsMarketSelections,
  sportsMarketSelectionColor,
  sportsMarketSelectionLabel,
  sportsMoneylineSelectionSide,
  sportsMoneylineSelectionSlots,
  sportsMoneylineSlotCount,
  sportsOddsAnimationVariant,
  sportsPrimaryMarketCategories,
  SportsMatchGroupHeading,
  SportsShell,
} from "./SportsShell";

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

jest.mock("../../worldcup/odds/OddsNumber", () => ({
  OddsNumber: ({
    value,
    variant,
  }: {
    value: string | number;
    variant: string;
  }) => (
    <span data-testid="animated-odds-number" data-variant={variant}>
      {value}
    </span>
  ),
}));

const mobileTaxonomyScrollCases = [
  ["default live view", {}, "live"],
  ["proposals view", { view: "proposals" as const }, "proposals"],
  [
    "top-level taxonomy",
    { taxonomy_type: "sport" as const, taxonomy_slug: "soccer" },
    "soccer",
  ],
  [
    "nested taxonomy",
    { taxonomy_type: "league" as const, taxonomy_slug: "epl" },
    "soccer",
  ],
] as const;

describe("SportsShell taxonomy labels", () => {
  it("uses the World Cup price animation variants for sports market columns", () => {
    expect(sportsOddsAnimationVariant("moneyline")).toBe("fade");
    expect(sportsOddsAnimationVariant("spread")).toBe("roll");
    expect(sportsOddsAnimationVariant("total")).toBe("roll");
  });

  it("selects the supported primary market columns for each sport", () => {
    for (const sportSlug of [
      "tennis",
      "cricket",
      "pickleball",
      "lacrosse",
      "volleyball",
    ]) {
      expect(sportsPrimaryMarketCategories("sports", sportSlug)).toEqual([
        "moneyline",
      ]);
    }
    expect(sportsPrimaryMarketCategories("sports", "combat")).toEqual([
      "moneyline",
      "total",
    ]);
    expect(sportsPrimaryMarketCategories("esports")).toEqual([
      "moneyline",
      "total",
    ]);
    expect(sportsPrimaryMarketCategories("sports", "soccer")).toEqual([
      "moneyline",
      "spread",
      "total",
    ]);
  });

  it("selects the latest date group at or before the virtual range", () => {
    const groupIndexes = [0, 3, 7];

    expect(findActiveMatchGroupIndex(groupIndexes, 0)).toBe(0);
    expect(findActiveMatchGroupIndex(groupIndexes, 2)).toBe(0);
    expect(findActiveMatchGroupIndex(groupIndexes, 3)).toBe(3);
    expect(findActiveMatchGroupIndex(groupIndexes, 10)).toBe(7);
    expect(findActiveMatchGroupIndex([], 0)).toBeUndefined();
  });

  it("maps match detail markets into fixed moneyline, spread, and total columns", () => {
    const market = (market_type: string) => ({
      market_slug: market_type,
      market_type,
      label: market_type,
      outcomes: [],
    });
    const moneyline = market("moneyline");
    const spread = market("handicap_points");
    const total = market("total_goals");

    expect(resolvePrimarySportsMarkets([total, moneyline, spread])).toEqual({
      moneyline: [moneyline],
      spread: [spread],
      total: [total],
    });
  });

  it("limits desktop market columns to their fixed slot counts", () => {
    const outcomes = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        outcome: (index % 2 === 0 ? "yes" : "no") as "yes" | "no",
        label: `Outcome ${index}`,
        price: 0.5,
      }));
    const market = {
      market_slug: "market",
      market_type: "market",
      label: "Market",
      outcomes: outcomes(4),
    };

    expect(sportsMarketSelections("moneyline", [market])).toHaveLength(3);
    expect(sportsMarketSelections("spread", [market])).toHaveLength(2);
    expect(sportsMarketSelections("total", [market])).toHaveLength(2);
  });

  it("labels total selections with their localized side and line", () => {
    const market = {
      market_slug: "chi-hai-jin-2026-07-25-total-2pt5",
      market_type: "totals",
      label: "Qingdao Hainiu FC vs. Tianjin Jinmen Hu FC: O/U 2.5",
      line: 2.5,
      outcomes: [
        { outcome: "yes" as const, label: "Over", price: 0.48 },
        { outcome: "no" as const, label: "Under", price: 0.52 },
      ],
    };
    const selections = sportsMarketSelections("total", [market]);

    expect(
      selections.map((item, index) =>
        sportsMarketSelectionLabel(
          "total",
          item,
          index,
          selections.length,
          [],
          { draw: "Draw", total: { over: "O", under: "U" } },
        ),
      ),
    ).toEqual(["O 2.5", "U 2.5"]);
    expect(
      selections.map((item, index) =>
        sportsMarketSelectionLabel(
          "total",
          item,
          index,
          selections.length,
          [],
          { draw: "平", total: { over: "大", under: "小" } },
        ),
      ),
    ).toEqual(["大 2.5", "小 2.5"]);
  });

  it("labels both outcomes of one spread market with opposite lines", () => {
    const participants = [
      {
        name: "Qingdao Hainiu FC",
        role: "home",
        abbreviation: "HAI",
      },
      {
        name: "Tianjin Jinmen Hu FC",
        role: "away",
        abbreviation: "JIN",
      },
    ];
    const market = {
      market_slug: "chi-hai-jin-2026-07-25-spread-away-1pt5",
      market_type: "spreads",
      label: "Spread: Tianjin Jinmen Hu FC (-1.5)",
      line: -1.5,
      outcomes: [
        {
          outcome: "yes" as const,
          label: "Tianjin Jinmen Hu FC",
          price: 0.14,
        },
        {
          outcome: "no" as const,
          label: "Qingdao Hainiu FC",
          price: 0.86,
        },
      ],
    };
    const selections = sportsMarketSelections("spread", [market]);

    expect(
      selections.map((item, index) =>
        sportsMarketSelectionLabel(
          "spread",
          item,
          index,
          selections.length,
          participants,
          { draw: "Draw", total: { over: "O", under: "U" } },
        ),
      ),
    ).toEqual(["JIN -1.5", "HAI +1.5"]);
  });

  it("orders and labels moneyline selections as home, draw, and away", () => {
    const participants = [
      {
        name: "Qingdao Hainiu FC",
        role: "home",
        abbreviation: "HAI",
      },
      {
        name: "Tianjin Jinmen Hu FC",
        role: "away",
        abbreviation: "JIN",
      },
    ];
    const selection = (market_slug: string, label: string) => ({
      market: {
        market_slug,
        market_type: "moneyline",
        label,
        outcomes: [],
      },
      outcome: { outcome: "yes" as const, label: "Yes", price: 0.5 },
    });
    const draw = selection(
      "chi-hai-jin-2026-07-25-draw",
      "Will Qingdao Hainiu FC vs. Tianjin Jinmen Hu FC end in a draw?",
    );
    const home = selection(
      "chi-hai-jin-2026-07-25-hai",
      "Will Qingdao Hainiu FC win on 2026-07-25?",
    );
    const away = selection(
      "chi-hai-jin-2026-07-25-jin",
      "Will Tianjin Jinmen Hu FC win on 2026-07-25?",
    );

    expect(sportsMoneylineSelectionSide(draw, participants)).toBe("draw");
    expect(sportsMoneylineSelectionSide(home, participants)).toBe("home");
    expect(sportsMoneylineSelectionSide(away, participants)).toBe("away");
    const ordered = sportsMoneylineSelectionSlots(
      [draw, home, away],
      participants,
      3,
    );
    expect(ordered.map((item) => item?.market.market_slug)).toEqual([
      home.market.market_slug,
      draw.market.market_slug,
      away.market.market_slug,
    ]);
    expect(
      ordered.map((item, index) =>
        sportsMarketSelectionLabel(
          "moneyline",
          item!,
          index,
          ordered.length,
          participants,
          { draw: "Draw", total: { over: "O", under: "U" } },
        ),
      ),
    ).toEqual(["HAI", "Draw", "JIN"]);
    expect(
      sportsMarketSelectionLabel(
        "moneyline",
        home,
        0,
        ordered.length,
        participants.map((participant) => ({
          ...participant,
          abbreviation:
            participant.role === "home" ? "   " : participant.abbreviation,
        })),
        { draw: "Draw", total: { over: "O", under: "U" } },
      ),
    ).toBe("Qingdao Hainiu FC");
    expect(
      sportsMoneylineSelectionSide(
        selection(
          "chi-tie-qin-2026-07-25-tie",
          "Will Liaoning Tieren FC win on 2026-07-25?",
        ),
        [
          { name: "Liaoning Tieren FC", role: "home", abbreviation: "TIE" },
          { name: "Qingdao Xihaian FC", role: "away", abbreviation: "QIN" },
        ],
      ),
    ).toBe("home");
  });

  it("preserves fixed moneyline slots when selections are missing", () => {
    const participants = [
      { name: "Home FC", role: "home" },
      { name: "Away FC", role: "away" },
    ];
    const selection = (market_slug: string, label: string) => ({
      market: {
        market_slug,
        market_type: "moneyline",
        label,
        outcomes: [],
      },
      outcome: { outcome: "yes" as const, label: "Yes", price: 0.5 },
    });
    const home = selection("home-win", "Will Home FC win?");
    const draw = selection("draw", "Will the match end in a draw?");
    const away = selection("away-win", "Will Away FC win?");

    expect(sportsMoneylineSlotCount("soccer", [home, away], participants)).toBe(
      3,
    );
    expect(
      sportsMoneylineSelectionSlots([home, away], participants, 3).map(
        (item) => item?.market.market_slug,
      ),
    ).toEqual(["home-win", undefined, "away-win"]);
    expect(
      sportsMoneylineSelectionSlots([draw], participants, 3).map(
        (item) => item?.market.market_slug,
      ),
    ).toEqual([undefined, "draw", undefined]);
    expect(
      sportsMoneylineSelectionSlots([away], participants, 2).map(
        (item) => item?.market.market_slug,
      ),
    ).toEqual([undefined, "away-win"]);
  });

  it("colors only home and away moneyline selections", () => {
    const participants = [
      { name: "Home", role: "home", color: "#123456" },
      { name: "Away", role: "away", abbreviation: "AW", color: "#abcdef" },
    ];
    const selection = (label: string) => ({
      market: {
        market_slug: label.toLowerCase().replaceAll(" ", "-"),
        market_type: "moneyline",
        label,
        outcomes: [],
      },
      outcome: { outcome: "yes" as const, label: "Yes", price: 0.5 },
    });

    expect(
      sportsMarketSelectionColor(
        "moneyline",
        selection("Home to win"),
        2,
        3,
        participants,
      ),
    ).toBe("#123456");
    expect(
      sportsMarketSelectionColor(
        "moneyline",
        selection("Draw"),
        0,
        3,
        participants,
      ),
    ).toBeUndefined();
    expect(
      sportsMarketSelectionColor(
        "moneyline",
        selection("Away to win"),
        1,
        3,
        participants,
      ),
    ).toBe("#abcdef");
    expect(
      sportsMarketSelectionColor(
        "moneyline",
        {
          market: {
            market_slug: "chi-hai-jin-2026-07-25-hai",
            market_type: "moneyline",
            label: "Will Qingdao Hainiu FC win on 2026-07-25?",
            outcomes: [],
          },
          outcome: { outcome: "yes", label: "Yes", price: 0.35 },
        },
        1,
        3,
        [
          {
            name: "Qingdao Hainiu FC",
            role: "home",
            abbreviation: "HAI",
            color: "#e47444",
          },
          {
            name: "Tianjin Jinmen Hu FC",
            role: "away",
            abbreviation: "JIN",
            color: "#155293",
          },
        ],
      ),
    ).toBe("#e47444");
    expect(
      sportsMarketSelectionColor(
        "moneyline",
        selection("Yes"),
        1,
        2,
        participants,
      ),
    ).toBe("#abcdef");
    expect(
      sportsMarketSelectionColor(
        "moneyline",
        selection("Yes"),
        0,
        1,
        participants,
      ),
    ).toBeUndefined();
    expect(
      sportsMarketSelectionColor(
        "spread",
        selection("Home"),
        0,
        2,
        participants,
      ),
    ).toBeUndefined();
    expect(
      sportsMarketSelectionColor(
        "total",
        selection("Away"),
        1,
        2,
        participants,
      ),
    ).toBeUndefined();
  });

  it("limits the today tab to the current local calendar day", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-21T12:00:00+08:00"));
    try {
      const today = {
        match_group_slug: "today",
        section: "sports" as const,
        title: "Today",
        start_time: "2026-07-21T20:00:00+08:00",
      };
      const tomorrow = {
        ...today,
        match_group_slug: "tomorrow",
        title: "Tomorrow",
        start_time: "2026-07-22T00:00:00+08:00",
      };

      expect(matchesForToday([today, tomorrow])).toEqual([today]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("uses the selected taxonomy label as the title and renders the three list tabs", () => {
    render(
      <SportsShell
        section="sports"
        filters={{ taxonomy_type: "sport", taxonomy_slug: "soccer" }}
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

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "soccer",
    );
    expect(screen.getByTestId("sports-page-header").className).toContain(
      "border-b",
    );
    expect(screen.queryByText(/filters\.upcoming/i)).toBeNull();
    const todayTab = screen.getByRole("button", {
      name: /worldcup\.tab\.today/i,
    });
    const gamesTab = screen.getByRole("button", {
      name: /worldcup\.tab\.games/i,
    });
    expect(todayTab.getAttribute("aria-current")).toBeNull();
    expect(gamesTab.getAttribute("aria-current")).toBe("page");
    expect(
      screen.getByRole("button", { name: /worldcup\.tab\.props/i }),
    ).toBeDefined();
  });

  it("automatically loads the next live match page", async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        has_more: false,
        next_cursor: null,
        limit: 20,
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    try {
      render(
        <SportsShell
          section="sports"
          filters={{ view: "live" }}
          data={{
            matches: [],
            props: [],
            taxonomy: null,
            match_pagination: {
              has_more: true,
              next_cursor: "live-next",
              limit: 20,
            },
          }}
        />,
      );

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
        "cursor=live-next",
      );
      expect(
        screen.queryByRole("button", { name: "extend.portfolio.loadMore" }),
      ).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("places the list tabs and odds format on opposite sides without a title divider", () => {
    render(
      <SportsShell
        section="sports"
        filters={{ taxonomy_type: "sport", taxonomy_slug: "soccer" }}
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

    const toolbar = screen.getByTestId("sports-content-toolbar");
    const tabs = within(toolbar).getByRole("navigation");
    const oddsFormatButton = within(toolbar)
      .getByText("extend.worldcup.odds")
      .closest("button");

    expect(toolbar.className).toContain("justify-between");
    expect(toolbar.className).not.toContain("border-t");
    expect(tabs.className).not.toContain("border-t");
    expect(toolbar.firstElementChild).toBe(tabs);
    expect(toolbar.lastElementChild?.contains(oddsFormatButton)).toBe(true);
  });

  it("aligns one set of market headers with each date group", () => {
    render(<SportsMatchGroupHeading title="Wed, Jul 22" />);

    const groupHeading = screen.getByTestId("sports-match-group-heading");
    const marketHeaders = screen.getAllByTestId("sports-market-group-header");

    expect(groupHeading.className).toContain("pl-4");
    expect(groupHeading.className).toContain("pr-[17px]");
    expect(marketHeaders).toHaveLength(3);
    expect(
      screen.getAllByText("extend.worldcup.marketCol.moneyline"),
    ).toHaveLength(1);
    expect(
      screen.getAllByText("extend.worldcup.marketCol.spread"),
    ).toHaveLength(1);
    expect(screen.getAllByText("extend.worldcup.marketCol.total")).toHaveLength(
      1,
    );
    marketHeaders.forEach((header) => {
      expect(header.className).toContain("w-[128px]");
    });
  });

  it("adjusts date group headers to the sport's supported markets", () => {
    const { rerender } = render(
      <SportsMatchGroupHeading
        title="Wed, Jul 22"
        categories={sportsPrimaryMarketCategories("sports", "tennis")}
      />,
    );

    let marketHeaders = screen.getAllByTestId("sports-market-group-header");
    expect(marketHeaders).toHaveLength(1);
    expect(marketHeaders[0].className).toContain("w-[400px]");
    expect(marketHeaders[0].className).toContain("text-right");
    expect(screen.queryByText("extend.worldcup.marketCol.spread")).toBeNull();
    expect(screen.queryByText("extend.worldcup.marketCol.total")).toBeNull();

    rerender(
      <SportsMatchGroupHeading
        title="Wed, Jul 22"
        categories={sportsPrimaryMarketCategories("sports", "combat")}
      />,
    );
    marketHeaders = screen.getAllByTestId("sports-market-group-header");
    expect(marketHeaders).toHaveLength(2);
    expect(screen.queryByText("extend.worldcup.marketCol.spread")).toBeNull();
    expect(screen.getByText("extend.worldcup.marketCol.total")).toBeDefined();
    marketHeaders.forEach((header) => {
      expect(header.className).toContain("w-[128px]");
    });
  });

  it("uses the shared localized label at mobile, rail, and live entry points", () => {
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

    expect(screen.getAllByTestId("localized-taxonomy-label")).toHaveLength(3);
  });

  it("shows the target taxonomy and a list skeleton immediately after navigation", async () => {
    const taxonomy = {
      sections: [
        {
          section: "sports" as const,
          children: [
            {
              section: "sports" as const,
              node_type: "sport" as const,
              slug: "soccer",
              label: "Soccer",
            },
            {
              section: "sports" as const,
              node_type: "sport" as const,
              slug: "tennis",
              label: "Tennis",
            },
          ],
        },
      ],
    };
    const { container, rerender } = render(
      <SportsShell
        section="sports"
        filters={{ taxonomy_type: "sport", taxonomy_slug: "soccer" }}
        data={{
          matches: [
            {
              match_group_slug: "soccer-match",
              section: "sports",
              title: "Soccer match",
            },
          ],
          props: [],
          taxonomy,
        }}
      />,
    );

    fireEvent.click(screen.getAllByRole("link", { name: "tennis" })[1]);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "tennis",
    );
    const list = container.querySelector("#sports-list-scroll");
    expect(list?.getAttribute("aria-busy")).toBe("true");
    expect(
      list?.querySelector('[data-sports-list-loading="true"]'),
    ).not.toBeNull();
    expect(screen.queryByText("Soccer match")).toBeNull();

    rerender(
      <SportsShell
        section="sports"
        filters={{ taxonomy_type: "sport", taxonomy_slug: "tennis" }}
        data={{
          matches: [
            {
              match_group_slug: "tennis-match",
              section: "sports",
              title: "Tennis match",
            },
          ],
          props: [],
          taxonomy,
        }}
      />,
    );

    await waitFor(() => expect(list?.getAttribute("aria-busy")).toBeNull());
    expect(screen.queryByText("Tennis match")).toBeDefined();
  });

  it("keeps modified taxonomy clicks in the browser's native flow", () => {
    const { container } = render(
      <SportsShell
        section="sports"
        filters={{ taxonomy_type: "sport", taxonomy_slug: "soccer" }}
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

    fireEvent.click(screen.getAllByRole("link", { name: "tennis" })[1], {
      metaKey: true,
    });

    expect(
      container.querySelector("#sports-list-scroll")?.getAttribute("aria-busy"),
    ).toBeNull();

    fireEvent.click(screen.getAllByRole("link", { name: "tennis" })[1]);
    expect(
      container.querySelector("#sports-list-scroll")?.getAttribute("aria-busy"),
    ).toBe("true");

    fireEvent.click(screen.getAllByRole("link", { name: /live/i })[0]);
    expect(
      container.querySelector("#sports-list-scroll")?.getAttribute("aria-busy"),
    ).toBeNull();
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
    expect(screen.getAllByText("10")).toHaveLength(3);
    const mobileTaxonomyLink = container.querySelector(
      '[data-taxonomy-scroll-target="soccer"]',
    );
    expect(mobileTaxonomyLink).not.toBeNull();
    expect(
      mobileTaxonomyLink?.querySelector('img[src*="soccer.svg"]'),
    ).not.toBeNull();
    expect(
      mobileTaxonomyLink?.querySelector(".text-\\[11px\\]")?.textContent,
    ).toBe("10");
    const navigationGroups = container.querySelector(".divide-y");
    expect(navigationGroups?.classList.contains("divide-zinc-900")).toBe(true);
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
    const { container } = render(
      <SportsShell
        section="sports"
        filters={{ taxonomy_type: "league", taxonomy_slug: "epl" }}
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

    const mobileParentLink = container.querySelector(
      '[data-taxonomy-scroll-target="soccer"]',
    );
    const parentLinks = screen.getAllByRole("link", { name: /soccer/i });
    const desktopParentLink = parentLinks.find(
      (link) =>
        link.getAttribute("href") ===
          "/sports?taxonomy_type=sport&taxonomy_slug=soccer" &&
        link.classList.contains("h-8"),
    );

    expect(mobileParentLink?.classList.contains("bg-emerald-950")).toBe(true);
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
          filters={{ taxonomy_type: "sport", taxonomy_slug: "soccer" }}
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
        filters={{ taxonomy_type: "sport", taxonomy_slug: "soccer" }}
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
