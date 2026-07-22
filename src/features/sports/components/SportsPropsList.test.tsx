import { fireEvent, render, screen } from "@testing-library/react";
import { SportsPropsList } from "./SportsPropsList";

jest.mock("../../worldcup/odds/OddsFormatProvider", () => ({
  useOddsFormat: () => ["american", jest.fn()],
}));

jest.mock("../../worldcup/odds/OddsNumber", () => ({
  OddsNumber: ({ value }: { value: string }) => <span>{value}</span>,
}));

describe("SportsPropsList", () => {
  beforeEach(() => {
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
                  label: "Will Kylian Mbappé win?",
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
    expect(screen.queryByText("Yes")).toBeNull();
    expect(screen.getByText("+900")).toBeDefined();
    expect(screen.getByText("+300")).toBeDefined();
    expect(container.querySelector('[data-source="polymarket"]')).toBeNull();

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

    expect(screen.getByText("Yes")).toBeDefined();
    expect(screen.getByText("No")).toBeDefined();
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
