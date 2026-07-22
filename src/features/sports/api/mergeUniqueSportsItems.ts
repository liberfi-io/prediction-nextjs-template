/** Appends paginated records while preserving the first item for each key. */
export function mergeUniqueSportsItems<T>(
  current: T[],
  incoming: T[],
  keyOf: (item: T) => string,
): T[] {
  const keys = new Set(current.map(keyOf));
  return [
    ...current,
    ...incoming.filter((item) => {
      const key = keyOf(item);
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    }),
  ];
}
