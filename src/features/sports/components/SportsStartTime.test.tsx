import { render, screen } from "@testing-library/react";
import { SportsStartTime } from "./SportsStartTime";

describe("SportsStartTime", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders only the local time when requested", () => {
    const formatTime = jest
      .spyOn(Date.prototype, "toLocaleTimeString")
      .mockReturnValue("17:30");

    render(<SportsStartTime value="2026-07-25T17:30:00+08:00" timeOnly />);

    expect(screen.getByText("17:30")).toBeDefined();
    expect(formatTime).toHaveBeenCalledWith(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  });
});
