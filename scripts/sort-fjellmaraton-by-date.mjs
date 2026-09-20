#!/usr/bin/env node
/**
 * Leser eksisterende bildelenker fra src/content/fjellmaraton/index.yml,
 * henter fotograferingsdato/sist endret fra R2 for kun disse bildene,
 * og lagrer dem sortert tilbake i samme fil.
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
  console.log(`Leser bildelisten fra ${filePath}...`);

  const content = await readFile(filePath, 'utf-8');
  const urls = content.match(/https?:\/\/[^\s"']+/g) || [];

  if (urls.length === 0) {
    console.log('Fant ingen bilder i filen.');
    return;
  }

  console.log(`Fant ${urls.length} bilde(r) i Fjellmaraton-filen. Henter datoer...`);

  const items = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const key = url.replace(`${PUBLIC_URL}/`, '');

    process.stdout.write(`\rSjekker bilde ${i + 1} av ${urls.length}...`);

    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      items.push({ url, date: new Date(head.LastModified) });
    } catch {
      items.push({ url, date: new Date(0) });
    }
  }

  console.log('\nSorterer bildene etter dato (nyeste først)...');
  items.sort((a, b) => b.date - a.date);

  const sortedUrls = items.map((item) => item.url);
  const newYaml = `photos:\n${sortedUrls.map((url) => `  - "${url}"`).join('\n')}\n`;

  await writeFile(filePath, newYaml);

  console.log(`\nSuksess! Sorterte ${sortedUrls.length} bilder i ${filePath}.`);
}

main().catch((error) => {
  console.error('Feilet:', error.message);
  process.exit(1);
});
