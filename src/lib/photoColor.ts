import sharp from 'sharp';
import { fetchWithRetry } from './fetchBuffer';

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
