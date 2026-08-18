import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { fetchWithRetry } from './fetchBuffer';
import { hasStagedFile, markReferenced, stageImageWrite, STAGING_DIR } from './imageOutputQueue';

export const withBase = (path: string) =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

export const isRemote = (path: string) => /^https?:\/\//.test(path);

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
async function resolveStagedFilename(
  src: string,
  width: number,
  quality: number,
  format: 'webp' | 'jpeg' = 'webp'
): Promise<string> {
  // The cache key deliberately omits the format for webp, so every file
  // already staged from earlier builds stays valid instead of being rebuilt.
  const key = format === 'webp' ? `${src}:${width}:${quality}` : `${src}:${width}:${quality}:${format}`;
  const extension = format === 'jpeg' ? 'jpg' : 'webp';
  const filename = `${createHash('sha1').update(key).digest('hex')}.${extension}`;
  await markReferenced(filename);

  if (!(await hasStagedFile(filename))) {
    const buffer = await fetchWithRetry(src);
    const pipeline = sharp(buffer).rotate().resize({ width, withoutEnlargement: true });
    const resized = await (format === 'jpeg'
      ? pipeline.jpeg({ quality, mozjpeg: true })
      : pipeline.webp({ quality })
    ).toBuffer();

    await stageImageWrite(filename, resized);
  }

  return filename;
}

/**
 * A photo sized for link previews (iMessage, Facebook, Slack …).
 *
 * JPEG rather than the webp everything else uses: several link scrapers still
 * don't read webp, and a preview that silently fails to render is worse than a
 * slightly larger file. Small on purpose too — the originals here run to 28 MB,
 * far past what those services will download before giving up.
 */
export async function resolveOgImage(src: string, width = 1200, quality = 80): Promise<string> {
  if (!isRemote(src)) return withBase(src);

  const filename = await resolveStagedFilename(src, width, quality, 'jpeg');
  return withBase(`optimized/${filename}`);
}

export async function resolveImage(src: string, width: number, quality: number): Promise<string> {
  if (!isRemote(src)) return withBase(src);

  const filename = await resolveStagedFilename(src, width, quality);
  return withBase(`optimized/${filename}`);
}

/**
 * Resolves one photo at several widths and returns a ready-made `srcset`, so
 * a phone can fetch a ~800px file where a desktop gets the full 2000px one.
 * Without this every device downloads the same file — the homepage covers run
 * up to 2.7 MB each, which is a lot to send to a phone on mobile data for an
 * image it will never render wider than ~350px.
 *
 * Downloads the original once and resizes it N times, rather than calling
 * resolveImage() per width — that would re-fetch the same (large) original
 * from R2 once for every size.
 *
 * Descriptors report each file's *real* width, not the width that was asked
 * for: `withoutEnlargement` means a small original comes back smaller than
 * requested, and claiming otherwise would have the browser pick a file
 * expecting more detail than it holds. Sizes that collapse onto the same real
 * width are emitted once.
 */
export async function resolveImageSrcSet(
  src: string,
  widths: number[],
  quality: number
): Promise<{ src: string; srcset: string; aspectRatio: number }> {
  if (!isRemote(src)) return { src: withBase(src), srcset: '', aspectRatio: 1 };

  const ordered = [...widths].sort((a, b) => a - b);
  const entries = ordered.map((width) => ({
    width,
    filename: `${createHash('sha1').update(`${src}:${width}:${quality}`).digest('hex')}.webp`,
  }));

  await Promise.all(entries.map((entry) => markReferenced(entry.filename)));

  const missing: typeof entries = [];
  for (const entry of entries) {
    if (!(await hasStagedFile(entry.filename))) missing.push(entry);
  }

  if (missing.length > 0) {
    const buffer = await fetchWithRetry(src);

    for (const entry of missing) {
      const resized = await sharp(buffer)
        .rotate()
        .resize({ width: entry.width, withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();

      await stageImageWrite(entry.filename, resized);
    }
  }

  const measured = await Promise.all(
    entries.map(async (entry) => {
      const metadata = await sharp(path.join(STAGING_DIR, entry.filename)).metadata();
      return { ...entry, realWidth: metadata.width ?? entry.width, realHeight: metadata.height ?? 0 };
    })
  );

  const seen = new Set<number>();
  const candidates = measured.filter((entry) => {
    if (seen.has(entry.realWidth)) return false;
    seen.add(entry.realWidth);
    return true;
  });

  const largest = candidates[candidates.length - 1];

  return {
    src: withBase(`optimized/${largest.filename}`),
    srcset: candidates
      .map((entry) => `${withBase(`optimized/${entry.filename}`)} ${entry.realWidth}w`)
      .join(', '),
    aspectRatio: largest.realHeight > 0 ? largest.realWidth / largest.realHeight : 1,
  };
}

/**
 * Same as resolveImage, but also returns the resized photo's real aspect
 * ratio (read straight from the staged file's own metadata — not Astro's
 * inferSize, which has the bug described above). Callers can use this to
 * reserve layout space for an <img> via CSS aspect-ratio before it loads,
 * so it doesn't collapse to 0 height while unloaded — which, for a page
 * that's nothing but loading="lazy" photos, can starve the ones further
 * down from ever intersecting the viewport and loading at all.
 */
export async function resolveImageWithAspectRatio(
  src: string,
  width: number,
  quality: number
): Promise<{ src: string; aspectRatio: number }> {
  if (!isRemote(src)) return { src: withBase(src), aspectRatio: 1 };

  const filename = await resolveStagedFilename(src, width, quality);
  const metadata = await sharp(path.join(STAGING_DIR, filename)).metadata();
  const aspectRatio = metadata.width && metadata.height ? metadata.width / metadata.height : 1;

  return { src: withBase(`optimized/${filename}`), aspectRatio };
}
