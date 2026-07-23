import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import Loading from "./loading";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("@liberfi.io/ui-predict", () => ({
  EventsPageSkeleton: () => <div data-testid="events-skeleton" />,
}));

jest.mock("../components/page/portfolio-skeleton", () => ({
  PortfolioSkeleton: () => <div data-testid="portfolio-skeleton" />,
}));

jest.mock("../features/leaderboard/components/skeletons", () => ({
  LeaderboardSkeleton: () => <div data-testid="leaderboard-skeleton" />,
}));

jest.mock("../features/worldcup/components/skeletons", () => ({
  WorldCupTabSkeleton: () => <div data-testid="world-cup-skeleton" />,
}));

jest.mock("../features/sports/components/SportsPageSkeleton", () => ({
  SportsPageSkeleton: () => <div data-testid="sports-skeleton" />,
}));

const mockUsePathname = jest.mocked(usePathname);

describe("root loading fallback", () => {
  it.each([
    ["/events", "events-skeleton"],
    ["/portfolio", "portfolio-skeleton"],
    ["/leaderboard", "leaderboard-skeleton"],
    ["/world-cup/games", "world-cup-skeleton"],
    ["/sports", "sports-skeleton"],
    ["/esports", "sports-skeleton"],
  ])("uses the skeleton for %s", (pathname, testId) => {
    mockUsePathname.mockReturnValue(pathname);

    const { unmount } = render(<Loading />);

    expect(screen.getByTestId(testId)).toBeTruthy();
    unmount();
  });
});
