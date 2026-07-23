import { fireEvent, render, screen } from "@testing-library/react";
import { useAsyncModal } from "@liberfi.io/ui-scaffold";
import { SportsPropsList } from "./SportsPropsList";

const mockOpenTradeModal = jest.fn();

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
  OddsNumber: ({ value }: { value: string }) => <span>{value}</span>,
}));

describe("SportsPropsList", () => {
  beforeEach(() => {
    mockOpenTradeModal.mockReset();
    (useAsyncModal as jest.Mock).mockReturnValue({
      onOpen: mockOpenTradeModal,
    });

    class TestIntersectionObserver {
      constructor(private readonly callback: IntersectionObserverCallback) {}

      observe(element: Element) {
        this.callback(
          [
            {
              isIntersecting: true,
              target: element,
            } as IntersectionObserverEntry,
          ],
          this as unknown as IntersectionObserver,
        );
      }

      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
      readonly root = null;
      readonly rootMargin = "300px";
      readonly thresholds = [0];
    }

    window.IntersectionObserver =
      TestIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  it("renders independent props cards with event data and selected odds format", () => {
    const { container } = render(
      <SportsPropsList
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
    expect(screen.getAllByText("Yes")).toHaveLength(2);
    expect(screen.getByText("+900")).toBeDefined();
    expect(screen.getByText("+300")).toBeDefined();
    expect(container.querySelector('[data-source="polymarket"]')).toBeNull();
    expect(screen.getByTestId("predict-trade-modal")).toBeDefined();

    fireEvent.click(
      screen.getByText("Will Kylian Mbappé win?").closest("button")!,
    );
    const yesButton = screen.getByRole("button", { name: "Yes +900" });
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
  });

  it("renders both outcome labels for a single binary market", () => {
    render(
      <SportsPropsList
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

    expect(screen.getByRole("button", { name: "Yes +400" })).toBeDefined();
    expect(screen.getByRole("button", { name: "No -400" })).toBeDefined();
    expect(
      screen.getByRole("link", { name: "WI Will Ronaldo retire?" }),
    ).toBeDefined();
    expect(screen.getByText("+400")).toBeDefined();
    expect(screen.getByText("-400")).toBeDefined();
  });

  it("automatically loads the next props page", () => {
    const onLoadMore = jest.fn();
    render(
      <SportsPropsList
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

  it("uses a title fallback when the event image fails", () => {
    const { container } = render(
      <SportsPropsList
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
