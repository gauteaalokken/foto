import sharp from 'sharp';
import { fetchWithRetry } from './fetchBuffer';

/** Get a photo's true width/height ratio (post EXIF-rotation), for justified-layout sizing. */
export async function getImageAspectRatio(src: string): Promise<number> {
  const buffer = await fetchWithRetry(src);

  const { width, height } = await sharp(buffer).rotate().metadata();

  if (!width || !height) return 3 / 4;

  return width / height;
}
