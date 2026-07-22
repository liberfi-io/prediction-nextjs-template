import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { SportsPropsList } from "./SportsPropsList";

jest.mock("@liberfi.io/ui-predict", () => ({
  EventsUI: ({ events }: { events: Array<{ title: string }> }) => (
    <div className="evt-card-grid">
      {events.map((event) => (
        <div key={event.title}>{event.title}</div>
      ))}
    </div>
  ),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));

describe("SportsPropsList", () => {
  it("uses two card columns on desktop and one on mobile", () => {
    const { container } = render(
      <SportsPropsList
        page={{
          items: [
            {
              event_slug: "top-scorer",
              section: "sports",
              title: "Top scorer",
            },
          ],
          has_more: false,
          limit: 20,
        }}
        loading={false}
        onLoadMore={jest.fn()}
      />,
    );

    expect(screen.getByText("Top scorer")).toBeDefined();
    const gridStyles = container.querySelector("style")?.textContent;
    expect(gridStyles).toContain(".sports-props-grid .evt-card-grid,");
    expect(gridStyles).toContain(
      ".sports-props-grid .sports-props-skeleton-grid",
    );
    expect(gridStyles).toContain("repeat(2, minmax(0, 1fr))");
    expect(container.querySelector("style")?.textContent).toContain(
      "@media (max-width: 767px)",
    );
    expect(container.querySelector("style")?.textContent).not.toContain(
      "repeat(3, minmax(0, 1fr))",
    );
  });
});
