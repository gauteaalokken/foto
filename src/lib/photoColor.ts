import sharp from 'sharp';

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

/** Get a 0-360 hue for a photo by averaging its pixels, for rainbow-style sorting. */
export async function getDominantHue(src: string): Promise<number> {
  const buffer = await fetchWithRetry(src);

  const { data } = await sharp(buffer)
    .rotate()
    .resize(1, 1, { fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const [r, g, b] = data;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) return 0;

  let hue: number;

  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue *= 60;

  return hue < 0 ? hue + 360 : hue;
}
