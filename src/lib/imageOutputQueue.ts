import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Pages render before Astro finishes writing dist/, and writing straight into
 * public/ or dist/ during rendering isn't safe (Astro copies/clears them at
 * points we don't control). Pages stage their generated image bytes here on
 * disk instead; the astro:build:done integration hook in astro.config.mjs
 * copies the staging dir into dist/optimized once Astro confirms the output
 * directory is final. Using the filesystem (rather than an in-memory queue)
 * avoids relying on module state being shared between Astro's config loader
 * and the page-rendering pipeline, which load modules separately.
 *
 * This directory is restored/saved across CI runs via actions/cache, so a
 * photo already resized in a previous build doesn't need to be re-fetched
 * and re-resized every single time — see hasStagedFile/markReferenced below.
 */
export const STAGING_DIR = path.join(process.cwd(), 'node_modules', '.image-staging');
const MANIFEST_PATH = path.join(STAGING_DIR, '.referenced');

export async function hasStagedFile(filename: string): Promise<boolean> {
  try {
    await access(path.join(STAGING_DIR, filename));
    return true;
  } catch {
    return false;
  }
}

export async function stageImageWrite(filename: string, buffer: Buffer) {
  await mkdir(STAGING_DIR, { recursive: true });
  await writeFile(path.join(STAGING_DIR, filename), buffer);
}

/** Records that this build actually used `filename`, whether freshly staged or restored from cache. */
export async function markReferenced(filename: string) {
  await mkdir(STAGING_DIR, { recursive: true });
  await appendFile(MANIFEST_PATH, `${filename}\n`);
}

export async function resetManifest() {
  await mkdir(STAGING_DIR, { recursive: true });
  await writeFile(MANIFEST_PATH, '');
}

export async function readManifest(): Promise<Set<string>> {
  try {
    const content = await readFile(MANIFEST_PATH, 'utf-8');
    return new Set(content.split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
}

export const MANIFEST_FILENAME = path.basename(MANIFEST_PATH);
