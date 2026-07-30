#!/usr/bin/env node
/**
 * Private tool — sorts your Cloudflare R2 photos by date or by color and writes the
 * result into a gallery YAML file. Only runs locally; nothing here is published.
 *
 * Usage:
 *   node scripts/sort-feed.mjs date [feed|gallery]
 *   node scripts/sort-feed.mjs color [feed|gallery]
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
  console.error('Usage: node scripts/sort-feed.mjs <date|color> [feed|gallery]');
  process.exit(1);
}

if (!['feed', 'gallery'].includes(target)) {
  console.error('Second argument must be "feed" or "gallery".');
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

/** Get a 0-360 hue for an image by averaging its pixels. */
async function getDominantHue(buffer) {
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

  let hue;

  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue *= 60;

  return hue < 0 ? hue + 360 : hue;
}

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

  const objects = await listAllObjects();

  console.log(`Found ${objects.length} photo(s).`);

  if (mode === 'date') {
    objects.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
  } else {
    const cache = await loadCache();
    let downloaded = 0;

    for (const obj of objects) {
      const cacheKey = `${obj.Key}:${obj.ETag}`;

      if (cache[cacheKey] !== undefined) {
        obj.hue = cache[cacheKey];
        continue;
      }

      downloaded += 1;
      process.stdout.write(`\rAnalyzing colors... ${downloaded} new photo(s) processed`);

      const buffer = await downloadObject(obj.Key);

      obj.hue = await getDominantHue(buffer);
      cache[cacheKey] = obj.hue;
    }

    if (downloaded > 0) console.log('');

    await saveCache(cache);
    objects.sort((a, b) => a.hue - b.hue);
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
