import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { fetchWithRetry } from './fetchBuffer';
import { hasStagedFile, markReferenced, stageImageWrite } from './imageOutputQueue';

const withBase = (path: string) =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

const isRemote = (path: string) => /^https?:\/\//.test(path);

/**
 * Resizes a photo with sharp and stages the bytes on disk (see imageOutputQueue.ts)
 * instead of using Astro's built-in getImage(). Two reasons: Astro's remote fetch
 * has no timeout, so a single stalled connection could hang the whole build; and
 * nothing about Astro's own image handling persists across separate `astro build`
 * runs, so every photo would be re-fetched and re-resized from R2 on every single
 * build regardless of whether it changed. The staging dir does persist across
 * builds (restored via actions/cache in CI), so an unchanged photo is skipped
 * entirely on repeat builds instead of being downloaded and resized again — this
 * is what makes builds with hundreds of photos tractable.
 *
 * No explicit height on the returned image on purpose: Astro's inferSize + width
 * combo has a bug where the reported height attribute doesn't match the real
 * resized file, which caused photos to render squeezed/cropped. Leaving height
 * unset lets the browser just use the image's real proportions once it loads.
 */
export async function resolveImage(src: string, width: number, quality: number): Promise<string> {
  if (!isRemote(src)) return withBase(src);

  const filename = `${createHash('sha1').update(`${src}:${width}:${quality}`).digest('hex')}.webp`;
  await markReferenced(filename);

  if (!(await hasStagedFile(filename))) {
    const buffer = await fetchWithRetry(src);
    const resized = await sharp(buffer)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    await stageImageWrite(filename, resized);
  }

  return withBase(`optimized/${filename}`);
}
