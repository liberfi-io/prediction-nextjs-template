import { render, screen } from "@testing-library/react";
import { SportsListLoadingState } from "./SportsListLoadingState";

describe("SportsListLoadingState", () => {
  it("renders the shared pulse rows without card shells", () => {
    const { container } = render(
      <SportsListLoadingState loadingLabel="Loading" />,
    );

    expect(screen.getByRole("status").textContent).toBe("Loading");
    expect(screen.getAllByTestId("sports-list-loading-row")).toHaveLength(5);
    expect(
      container.querySelector('[data-sports-list-loading="true"]'),
    ).not.toBeNull();
    expect(screen.queryByTestId("sports-prop-skeleton-card")).toBeNull();
  });
});
