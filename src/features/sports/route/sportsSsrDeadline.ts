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
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("sports ssr deadline exceeded"));
        }, remaining);
      });

      try {
        return await Promise.race([op(controller.signal), timeout]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
