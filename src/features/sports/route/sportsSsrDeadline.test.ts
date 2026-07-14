import { createSportsSsrDeadline } from "./sportsSsrDeadline";

describe("createSportsSsrDeadline", () => {
  it("tracks remaining budget from the injected clock", () => {
    let now = 100;
    const deadline = createSportsSsrDeadline(3000, () => now);

    expect(deadline.deadlineAt).toBe(3100);
    expect(deadline.remainingMs()).toBe(3000);

    now = 2600;
    expect(deadline.remainingMs()).toBe(500);
  });

  it("aborts operations when the remaining budget expires", async () => {
    const deadline = createSportsSsrDeadline(1);

    await expect(
      deadline.withRemainingTimeout(
        (signal) =>
          new Promise((_, reject) => {
            signal.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
      ),
    ).rejects.toThrow("aborted");
  });
});
