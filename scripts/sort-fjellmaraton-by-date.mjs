#!/usr/bin/env node
/**
 * Leser kun faktiske bildelenker (.jpg, .png, osv) fra index.yml,
 * sorterer dem etter dato i R2, og oppdaterer "photos:" uten å ødelegge resten av filen.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

process.loadEnvFile?.('.env.local');

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '1904e782382751217d6103b2d39a41da';
const BUCKET = process.env.R2_BUCKET ?? 'foto-photos';
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? 'a74d879decb219fc298c10edd12ecda5';
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const PUBLIC_URL = process.env.R2_PUBLIC_URL ?? 'https://pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev';

if (!SECRET_ACCESS_KEY) {
  console.error('Mangler R2_SECRET_ACCESS_KEY i .env.local');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
});

async function main() {
  const filePath = path.join('src', 'content', 'fjellmaraton', 'index.yml');
  console.log(`Leser ${filePath}...`);

  const content = await readFile(filePath, 'utf-8');

  // Finn KUN bildelenker (.jpg, .png, .jpeg, .webp)
  const imageRegex = /https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/gi;
  const imageUrls = Array.from(new Set(content.match(imageRegex) || []));

  if (imageUrls.length === 0) {
    console.log('Fant ingen bildelenker (.jpg/.png) i filen.');
    return;
  }

  console.log(`Fant ${imageUrls.length} unike bilde(r). Henter datoer fra R2...`);

  const items = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const key = url.replace(`${PUBLIC_URL}/`, '');

    process.stdout.write(`\rSjekker bilde ${i + 1} av ${imageUrls.length}...`);

    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      items.push({ url, date: new Date(head.LastModified) });
    } catch {
      items.push({ url, date: new Date(0) });
    }
  }

  console.log('\nSorterer bildene etter dato (nyeste først)...');
  items.sort((a, b) => b.date - a.date);

  const sortedUrlsList = items.map((item) => `  - "${item.url}"`).join('\n');

  // Erstatt KUN "photos:"-blokken og ta vare på tittel, GPX-lenker og kart!
  let newContent;
  if (/photos:\s*/.test(content)) {
    newContent = content.replace(/photos:\s*(?:\n\s*-\s*"[^"]+")+/g, `photos:\n${sortedUrlsList}`);
  } else {
    newContent = `${content.trim()}\n\nphotos:\n${sortedUrlsList}\n`;
  }

  await writeFile(filePath, newContent);

  console.log(`\nSuksess! Sorterte ${items.length} bilder uten å røre kart eller GPX-lenker.`);
}

main().catch((error) => {
  console.error('Feilet:', error.message);
  process.exit(1);
});
