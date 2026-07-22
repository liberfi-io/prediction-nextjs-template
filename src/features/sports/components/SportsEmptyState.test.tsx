import { render, screen } from "@testing-library/react";
import { SportsEmptyState } from "./SportsEmptyState";

describe("SportsEmptyState", () => {
  it("renders an icon and label without a bordered container", () => {
    const { container } = render(<SportsEmptyState label="No matches" />);

    expect(screen.getByTestId("sports-empty-state-icon")).toBeDefined();
    expect(screen.getByText("No matches")).toBeDefined();
    expect(container.firstElementChild?.className).not.toContain("border");
  });
});
