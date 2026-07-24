// Run async work over a list with a max number of tasks in flight at once, so we
// don't overwhelm R2 with dozens of simultaneous connections (which can cause
// transient "other side closed" fetch failures).
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]);
    }
  });

  await Promise.all(workers);

  return results;
}
