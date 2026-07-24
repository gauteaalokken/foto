import sharp from 'sharp';

// Astro's inferSize + explicit `width` combo mislabels the resulting <img height>
// for remote images: the actual resized file comes out correctly proportioned, but
// the reported height attribute stays the original (unscaled) value, which makes
// browsers stretch the image to fill the wrongly-shaped box. We work around it by
// reading the real source dimensions ourselves and computing the height directly.
async function fetchWithRetry(src: string, attempts = 3): Promise<Buffer> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(src);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (attempt === attempts) throw error;
    }
  }

  throw new Error(`Failed to fetch ${src}`);
}

export async function getScaledDimensions(src: string, targetWidth: number) {
  const buffer = await fetchWithRetry(src);
  const metadata = await sharp(buffer).metadata();

  const swapped = (metadata.orientation ?? 1) >= 5;
  const width = (swapped ? metadata.height : metadata.width) ?? targetWidth;
  const height = (swapped ? metadata.width : metadata.height) ?? targetWidth;

  return { width: targetWidth, height: Math.round(height * (targetWidth / width)) };
}

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
