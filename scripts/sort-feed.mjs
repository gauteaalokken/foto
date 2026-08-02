#!/usr/bin/env node
/**
 * Private tool — sorts your Cloudflare R2 photos by date or by color and writes the
 * result into a gallery YAML file. Only runs locally; nothing here is published.
 *
 * Usage:
 *   node scripts/sort-feed.mjs date [feed]
 *   node scripts/sort-feed.mjs color [feed]
 *
 * Requires a .env.local file (git-ignored) with:
 *   R2_SECRET_ACCESS_KEY=your-secret-access-key
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

process.loadEnvFile?.('.env.local');

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '1904e782382751217d6103b2d39a41da';
const BUCKET = process.env.R2_BUCKET ?? 'foto-photos';
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? 'a74d879decb219fc298c10edd12ecda5';
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const PUBLIC_URL = process.env.R2_PUBLIC_URL ?? 'https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev';

const [, , mode, target = 'feed'] = process.argv;

if (!SECRET_ACCESS_KEY) {
  console.error(
    'Missing R2_SECRET_ACCESS_KEY.\n' +
      'Create a .env.local file in the project root (it is git-ignored, never uploaded) with:\n' +
      '  R2_SECRET_ACCESS_KEY=your-secret-access-key\n' +
      '(the same secret you used when setting up the CMS uploader).'
  );
  process.exit(1);
}

if (!['date', 'color'].includes(mode)) {
  console.error('Usage: node scripts/sort-feed.mjs <date|color> [feed]');
  process.exit(1);
}

if (target !== 'feed') {
  console.error('Second argument must be "feed".');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
});

/** List every object in the bucket, following pagination. */
async function listAllObjects() {
  const objects = [];
  let continuationToken;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: continuationToken })
    );

    for (const obj of response.Contents ?? []) {
      if (!obj.Key.endsWith('/')) objects.push(obj);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

/** Download an object's bytes. */
async function downloadObject(key) {
  const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks = [];

  for await (const chunk of response.Body) chunks.push(chunk);

  return Buffer.concat(chunks);
}

/**
 * HSL of a single RGB pixel (0-255 channels). Matches the algorithm in
 * public/fotoverktoy/grid.html's "Sorter etter farge" so the homepage/feed
 * pre-sort and the Fotogrid tool order photos the same way.
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }

  return { h: h * 360, s, l };
}

/**
 * Dominant color of an image, sampled from every pixel of a small resize.
 * Averaging RGB first (the old approach — resizing straight to 1x1) muddies
 * mixed-color scenes toward brown/olive: a red flower on green leaves
 * averages to neither. Instead, convert each pixel to HSL and take a
 * circular mean of hue weighted by sat^2, so a small saturated subject
 * against a duller background still sets the photo's sort color, and hues
 * near the 0/360 seam average correctly (a plain numeric mean of e.g. 350°
 * and 10° would wrongly give 180°).
 */
async function getDominantColor(buffer) {
  const { data, info } = await sharp(buffer)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(48, 48, { fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  let sumX = 0, sumY = 0, sumWeight = 0, sumL = 0, sumS = 0, count = 0;

  for (let i = 0; i + 2 < data.length; i += channels) {
    const hsl = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const weight = hsl.s * hsl.s;
    const rad = (hsl.h * Math.PI) / 180;
    sumX += weight * Math.cos(rad);
    sumY += weight * Math.sin(rad);
    sumWeight += weight;
    sumL += hsl.l;
    sumS += hsl.s;
    count++;
  }

  if (count === 0) return { hue: 0, sat: 0, light: 0.5 };

  let hue = 0;
  if (sumWeight > 1e-6) {
    hue = (Math.atan2(sumY, sumX) * 180) / Math.PI;
    if (hue < 0) hue += 360;
  }

  return { hue, sat: sumS / count, light: sumL / count };
}

/**
 * Hue is circular (0deg and 360deg are the same color), so a plain ascending
 * sort splits near-identical reds to opposite ends of the sequence. Rotates
 * the array to start right after the single largest gap between consecutive
 * hues, so that seam lands where there are the fewest photos.
 */
function rotateAtLargestHueGap(colored) {
  if (colored.length <= 2) return colored;

  let maxGap = -1;
  let gapIndex = colored.length - 1;

  for (let i = 0; i < colored.length - 1; i++) {
    const gap = colored[i + 1].hue - colored[i].hue;
    if (gap > maxGap) { maxGap = gap; gapIndex = i; }
  }

  const wrapGap = colored[0].hue + 360 - colored[colored.length - 1].hue;
  if (wrapGap > maxGap) gapIndex = colored.length - 1;

  return [...colored.slice(gapIndex + 1), ...colored.slice(0, gapIndex + 1)];
}

const SAT_THRESHOLD = 0.15;
const COLOR_CACHE_VERSION = 2;

const CACHE_PATH = path.join('scripts', '.color-cache.json');

async function loadCache() {
  try {
    return JSON.parse(await (await import('node:fs/promises')).readFile(CACHE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function main() {
  console.log(`Listing objects in bucket "${BUCKET}"...`);

  let objects = await listAllObjects();

  console.log(`Found ${objects.length} photo(s).`);

  if (mode === 'date') {
    objects.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
  } else {
    const cache = await loadCache();
    let downloaded = 0;

    for (const obj of objects) {
      const cacheKey = `${obj.Key}:${obj.ETag}`;
      const cached = cache[cacheKey];

      if (cached && cached.v === COLOR_CACHE_VERSION) {
        obj.hue = cached.hue;
        obj.sat = cached.sat;
        obj.light = cached.light;
        continue;
      }

      downloaded += 1;
      process.stdout.write(`\rAnalyzing colors... ${downloaded} new photo(s) processed`);

      const buffer = await downloadObject(obj.Key);
      const color = await getDominantColor(buffer);

      obj.hue = color.hue;
      obj.sat = color.sat;
      obj.light = color.light;
      cache[cacheKey] = { ...color, v: COLOR_CACHE_VERSION };
    }

    if (downloaded > 0) console.log('');

    await saveCache(cache);

    const grayscale = objects.filter((obj) => obj.sat < SAT_THRESHOLD);
    const colored = objects.filter((obj) => obj.sat >= SAT_THRESHOLD);

    grayscale.sort((a, b) => a.light - b.light);
    colored.sort((a, b) => a.hue - b.hue || a.light - b.light);

    objects = [...grayscale, ...rotateAtLargestHueGap(colored)];
  }

  const photoUrls = objects.map((obj) => `${PUBLIC_URL}/${obj.Key}`);

  const yaml = `photos:\n${photoUrls.map((url) => `  - "${url}"`).join('\n')}\n`;
  const outPath = path.join('src', 'content', target, 'index.yml');

  await writeFile(outPath, target === 'feed' && photoUrls.length === 0 ? 'photos: []\n' : yaml);

  console.log(`Wrote ${photoUrls.length} photo(s), sorted by ${mode}, to ${outPath}`);
  console.log('Review the change, then commit and push it yourself when ready.');
}

main().catch((error) => {
  console.error('Failed:', error.message);
  process.exit(1);
});
