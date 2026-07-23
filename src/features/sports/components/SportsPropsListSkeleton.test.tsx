import { render, screen } from "@testing-library/react";
import { SportsPropsListSkeleton } from "./SportsPropsListSkeleton";

describe("SportsPropsListSkeleton", () => {
  it("matches the props-card grid, height, and border treatment", () => {
    const { container } = render(
      <SportsPropsListSkeleton loadingLabel="Loading" />,
    );

    expect(screen.getByRole("status").textContent).toBe("Loading");
    const cards = screen.getAllByTestId("sports-prop-skeleton-card");
    expect(cards).toHaveLength(6);
    expect(cards[0]?.className).toContain("min-h-[248px]");
    expect(cards[0]?.className).toContain("border-[rgba(39,39,42,0.65)]");
    expect(cards[0]?.className).toContain("bg-[rgba(24,24,27,0.4)]");

    const gridStyles = container.querySelector("style")?.textContent;
    expect(gridStyles).toContain("repeat(2, minmax(0, 1fr))");
  });
});
