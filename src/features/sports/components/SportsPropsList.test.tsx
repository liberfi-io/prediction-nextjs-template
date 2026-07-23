import { fireEvent, render, screen } from "@testing-library/react";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import { SportsPropsList } from "./SportsPropsList";

const mockOpenTradeModal = jest.fn();
const mockGetScrollElement = () => document.body;
const mockMeasureElement = jest.fn();
const mockUseVirtualizer = jest.fn(({ count }: { count: number }) => ({
  getVirtualItems: () =>
    Array.from({ length: count }, (_, index) => ({
      index,
      key: index,
      start: index * 264,
    })),
  getTotalSize: () => count * 264,
  measureElement: mockMeasureElement,
}));

jest.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: { count: number }) => mockUseVirtualizer(options),
}));

jest.mock("@liberfi.io/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "predict.market.yes": "是",
        "predict.market.no": "否",
        "predict.event.viewEvent": "View Event",
        "predict.event.showMore": "Show More",
        "predict.event.back": "Back",
        "predict.event.volume": "vol",
      })[key] ?? key,
  }),
}));

jest.mock("@liberfi.io/ui-predict", () => ({
  PREDICT_TRADE_MODAL_ID: "predict-trade",
  PredictTradeModal: () => <div data-testid="predict-trade-modal" />,
}));

jest.mock("@liberfi.io/ui-scaffold", () => ({
  useAsyncModal: jest.fn(),
}));

jest.mock("../../worldcup/odds/OddsFormatProvider", () => ({
  useOddsFormat: () => ["american", jest.fn()],
}));

jest.mock("../../worldcup/odds/OddsNumber", () => ({
  OddsNumber: ({
    value,
    variant,
  }: {
    value: string;
    variant: string;
  }) => <span data-odds-variant={variant}>{value}</span>,
}));

describe("SportsPropsList", () => {
  beforeEach(() => {
    mockOpenTradeModal.mockReset();
    mockMeasureElement.mockReset();
    mockUseVirtualizer.mockClear();
    (useAsyncModal as jest.Mock).mockReturnValue({
      onOpen: mockOpenTradeModal,
    });
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
  });

  it("renders independent props cards with event data and selected odds format", () => {
    const { container } = render(
      <SportsPropsList
        getScrollElement={mockGetScrollElement}
        page={{
          items: [
            {
              event_slug: "ballon-dor-winner-2026",
              event_type: "prop",
              section: "sports",
              title: "Ballon d'Or Winner 2026",
              image_url: "https://example.com/ballon-dor.png",
              volume: 1234,
              markets: [
                {
                  market_slug: "mbappe",
                  condition_id: "0xmbappe",
                  label: "Will Kylian Mbappé win?",
                  status: "open",
                  provider_meta: {
                    "polymarket.clobTokenIds": ["yes-token", "no-token"],
                    "polymarket.negRisk": true,
                  },
                  outcomes: [
                    { outcome: "yes", label: "Yes", price: 0.1 },
                    { outcome: "no", label: "No", price: 0.9 },
                  ],
                },
                {
                  market_slug: "haaland",
                  label: "Will Erling Haaland win?",
                  outcomes: [
                    { outcome: "yes", label: "Yes", price: 0.25 },
                    { outcome: "no", label: "No", price: 0.75 },
                  ],
                },
              ],
            },
          ],
          has_more: false,
          limit: 20,
        }}
        loading={false}
        onLoadMore={jest.fn()}
      />,
    );

    const card = screen.getByTestId("sports-prop-card");
    expect(card.className).toContain("border-[rgba(39,39,42,0.65)]");
    expect(card.className).toContain("hover:border-[rgba(63,63,70,0.55)]");
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/ballon-dor.png",
    );
    expect(card.textContent).toContain("$1.2K");
    expect(screen.getByText("Will Kylian Mbappé win?")).toBeDefined();
    expect(screen.getByText("Will Erling Haaland win?")).toBeDefined();
    expect(screen.getAllByText("是")).toHaveLength(2);
    expect(screen.getByText("+900")).toBeDefined();
    expect(screen.getByText("+300")).toBeDefined();
    expect(
      container.querySelectorAll('[data-odds-variant="roll"]'),
    ).toHaveLength(2);
    expect(container.querySelector('[data-source="polymarket"]')).toBeNull();
    expect(screen.getByTestId("predict-trade-modal")).toBeDefined();
    const titleLink = screen.getByRole("link", {
      name: "Ballon d'Or Winner 2026",
    });
    expect(titleLink.className).toContain("cursor-pointer");
    expect(mockUseVirtualizer).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 1,
        estimateSize: expect.any(Function),
        getScrollElement: expect.any(Function),
        overscan: 3,
      }),
    );
    expect(
      screen.getByTestId("sports-props-virtual-list").style.height,
    ).toBe("264px");
    expect(card.closest(".p-2")?.getAttribute("style")).toBeNull();

    fireEvent.click(
      screen.getByText("Will Kylian Mbappé win?").closest("button")!,
    );
    expect(
      screen.getByRole("link", { name: "Ballon d'Or Winner 2026" }),
    ).toBeDefined();
    expect(
      container.querySelectorAll('[data-odds-variant="roll"]'),
    ).toHaveLength(3);
    const yesButton = screen.getByRole("button", { name: "是 +900" });
    fireEvent.mouseEnter(yesButton);
    expect(yesButton.style.transform).toBe("translateY(2px)");
    fireEvent.click(yesButton);
    expect(mockOpenTradeModal).toHaveBeenCalledWith({
      params: expect.objectContaining({
        initialOutcome: "yes",
        event: expect.objectContaining({ slug: "ballon-dor-winner-2026" }),
        market: expect.objectContaining({
          slug: "mbappe",
          question: "Will Kylian Mbappé win?",
          provider_meta: {
            "polymarket.clobTokenIds": ["yes-token", "no-token"],
            "polymarket.negRisk": true,
          },
        }),
      }),
    });

    const gridStyles = container.querySelector("style")?.textContent;
    expect(gridStyles).toContain("repeat(2, minmax(0, 1fr))");
    expect(gridStyles).not.toContain("repeat(3, minmax(0, 1fr))");
    expect(gridStyles).not.toContain("sportsPropCardEnter");
  });

  it("renders both outcome labels for a single binary market", () => {
    render(
      <SportsPropsList
        getScrollElement={mockGetScrollElement}
        page={{
          items: [
            {
              event_slug: "ronaldo-retirement",
              section: "sports",
              title: "Will Ronaldo retire?",
              markets: [
                {
                  market_slug: "ronaldo-retirement",
                  label: "Will Ronaldo retire?",
                  outcomes: [
                    {
                      outcome: "yes",
                      label: "Yes",
                      price: 0.2,
                      best_ask: 0.55,
                    },
                    {
                      outcome: "no",
                      label: "No",
                      price: 0.8,
                      best_ask: 0.55,
                    },
                  ],
                },
              ],
            },
          ],
          has_more: false,
          limit: 20,
        }}
        loading={false}
        onLoadMore={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "是 +400" })).toBeDefined();
    expect(screen.getByRole("button", { name: "否 -400" })).toBeDefined();
    expect(
      screen.getByRole("link", { name: "WI Will Ronaldo retire?" }),
    ).toBeDefined();
    const viewEventLink = screen.getByRole("link", { name: "View Event" });
    expect(viewEventLink.className).toContain("cursor-pointer");
    expect(viewEventLink.className).toContain("hover:underline");
    expect(screen.getByText("+400")).toBeDefined();
    expect(screen.getByText("-400")).toBeDefined();
  });

  it("preserves custom outcome labels", () => {
    render(
      <SportsPropsList
        getScrollElement={mockGetScrollElement}
        page={{
          items: [
            {
              event_slug: "championship-winner",
              section: "sports",
              title: "Championship winner",
              markets: [
                {
                  market_slug: "championship-winner",
                  label: "Who will win?",
                  outcomes: [
                    { outcome: "yes", label: "Home", price: 0.2 },
                    { outcome: "no", label: "Away", price: 0.8 },
                  ],
                },
              ],
            },
          ],
          has_more: false,
          limit: 20,
        }}
        loading={false}
        onLoadMore={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Home +400" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Away -400" })).toBeDefined();
  });

  it("automatically loads the next props page", () => {
    const onLoadMore = jest.fn();
    render(
      <SportsPropsList
        getScrollElement={mockGetScrollElement}
        page={{
          items: [
            {
              event_slug: "top-scorer",
              section: "sports",
              title: "Top scorer",
            },
          ],
          has_more: true,
          next_cursor: "next",
          limit: 20,
        }}
        loading={false}
        onLoadMore={onLoadMore}
      />,
    );

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("virtualizes one card per row on mobile", () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    render(
      <SportsPropsList
        getScrollElement={mockGetScrollElement}
        page={{
          items: [
            {
              event_slug: "first-prop",
              section: "sports",
              title: "First prop",
            },
            {
              event_slug: "second-prop",
              section: "sports",
              title: "Second prop",
            },
          ],
          has_more: false,
          limit: 20,
        }}
        loading={false}
        onLoadMore={jest.fn()}
      />,
    );

    expect(mockUseVirtualizer).toHaveBeenLastCalledWith(
      expect.objectContaining({ count: 2 }),
    );
  });

  it("uses a title fallback when the event image fails", () => {
    const { container } = render(
      <SportsPropsList
        getScrollElement={mockGetScrollElement}
        page={{
          items: [
            {
              event_slug: "top-scorer",
              section: "sports",
              title: "Top scorer",
              image_url: "https://example.com/missing.png",
            },
          ],
          has_more: false,
          limit: 20,
        }}
        loading={false}
        onLoadMore={jest.fn()}
      />,
    );

    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByText("TO")).toBeDefined();
  });
});
