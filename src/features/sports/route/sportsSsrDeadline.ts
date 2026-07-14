export interface SportsSsrDeadline {
  deadlineAt: number;
  remainingMs(): number;
  withRemainingTimeout<T>(op: (signal: AbortSignal) => Promise<T>): Promise<T>;
}

export function createSportsSsrDeadline(
  totalMs: number,
  now: () => number = () => Date.now(),
): SportsSsrDeadline {
  const deadlineAt = now() + Math.max(0, totalMs);

  return {
    deadlineAt,
    remainingMs() {
      return Math.max(0, deadlineAt - now());
    },
    async withRemainingTimeout<T>(
      op: (signal: AbortSignal) => Promise<T>,
    ): Promise<T> {
      const remaining = Math.max(0, deadlineAt - now());
      if (remaining <= 0) {
        throw new Error("sports ssr deadline exceeded");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, remaining);

      try {
        return await op(controller.signal);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
