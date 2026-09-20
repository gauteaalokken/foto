#!/usr/bin/env node
/**
 * Private tool — reorders the photos already listed under `photos:` in
 * src/content/fjellmaraton/index.yml by when each one was actually taken
 * (EXIF capture date), newest first. Only touches that one list — topPhotos,
 * address and downloads are left exactly as they are. Runs locally; nothing
 * here is published.
 *
 * Usage:
 *   node scripts/sort-fjellmaraton-by-date.mjs
 *
 * No secrets needed — the photos are already public URLs, so this just
 * downloads the first part of each one over plain HTTP.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_PATH = path.join('src', 'content', 'fjellmaraton', 'index.yml');

/** Download just the first part of a photo — plenty to reach any EXIF data,
 *  which by the JPEG spec sits right after the start of the file and is at
 *  most 64 KB, without pulling down the full (often several MB) original. */
async function downloadHeader(url) {
  const res = await fetch(url, { headers: { Range: 'bytes=0-131071' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Reads a JPEG's embedded capture date (EXIF DateTimeOriginal, tag 0x9003),
 * falling back to DateTimeDigitized (0x9004) or the file's own DateTime
 * (0x0132). Returns null if there's no EXIF block, or none of those tags —
 * some editors strip this on export.
 */
function readExifCaptureDate(buffer) {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];

    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const length = buffer.readUInt16BE(offset + 2);

    if (marker === 0xe1) {
      const segmentStart = offset + 4;
      if (buffer.toString('ascii', segmentStart, segmentStart + 4) === 'Exif') {
        const date = parseTiffForDate(buffer, segmentStart + 6);
        if (date) return date;
      }
    }

    if (marker === 0xda) break; // Start of Scan — bildedata følger, ingen mer metadata

    offset += 2 + length;
  }

  return null;
}

function parseTiffForDate(buffer, tiffStart) {
  const little = buffer.toString('ascii', tiffStart, tiffStart + 2) === 'II';
  const readU16 = (o) => (little ? buffer.readUInt16LE(o) : buffer.readUInt16BE(o));
  const readU32 = (o) => (little ? buffer.readUInt32LE(o) : buffer.readUInt32BE(o));

  const readIfd = (ifdOffset) => {
    const count = readU16(ifdOffset);
    const entries = [];
    for (let i = 0; i < count; i++) {
      const start = ifdOffset + 2 + i * 12;
      entries.push({ tag: readU16(start), count: readU32(start + 4), valueOffset: start + 8 });
    }
    return entries;
  };

  const readAscii = (entry) => {
    const dataStart = entry.count <= 4 ? entry.valueOffset : tiffStart + readU32(entry.valueOffset);
    return buffer.toString('ascii', dataStart, dataStart + entry.count).replace(/\0.*$/, '');
  };

  // EXIF-datoer ser slik ut: "2026:08:27 15:03:12".
  const toDate = (str) => {
    const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(str);
    return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`) : null;
  };

  try {
    const ifd0 = readIfd(readU32(tiffStart + 4));
    const exifPointer = ifd0.find((e) => e.tag === 0x8769);

    if (exifPointer) {
      const exifIfd = readIfd(tiffStart + readU32(exifPointer.valueOffset));
      for (const tag of [0x9003, 0x9004]) {
        const entry = exifIfd.find((e) => e.tag === tag);
        const date = entry && toDate(readAscii(entry));
        if (date) return date;
      }
    }

    const fileDate = ifd0.find((e) => e.tag === 0x0132);
    return fileDate ? toDate(readAscii(fileDate)) : null;
  } catch {
    return null; // Uventet EXIF-struktur — hopp over i stedet for å krasje.
  }
}

/** Plukker ut photos:-listen fra YAML-fila, uten å røre resten av innholdet. */
function extractPhotoUrls(yamlText) {
  const match = /^photos:\n((?:[ \t]+-.*\n?)*)/m.exec(yamlText);
  if (!match) return null;

  return match[1]
    .split('\n')
    .filter((line) => line.trim().startsWith('-'))
    .map((line) => line.trim().replace(/^-\s*/, '').replace(/^"(.*)"$/, '$1'));
}

async function main() {
  const current = await readFile(OUT_PATH, 'utf-8');
  const urls = extractPhotoUrls(current);

  if (!urls) {
    console.error(`Fant ingen "photos:"-liste i ${OUT_PATH} — avbryter uten å skrive noe.`);
    process.exit(1);
  }

  console.log(`Leser opptaksdato for ${urls.length} bilde(r)...`);

  const withDates = [];
  for (let i = 0; i < urls.length; i++) {
    process.stdout.write(`\rLeser... ${i + 1}/${urls.length}`);
    const header = await downloadHeader(urls[i]);
    withDates.push({ url: urls[i], date: readExifCaptureDate(header) });
  }
  console.log('');

  const missing = withDates.filter((p) => !p.date).length;
  if (missing > 0) {
    console.log(
      `${missing} bilde(r) manglet opptaksdato i bildeinformasjonen og havner nederst, i sin nåværende innbyrdes rekkefølge.`
    );
  }

  // Nyeste tatte bilde først. Bilder uten dato beholder sin opprinnelige
  // rekkefølge seg imellom, i stedet for å spres tilfeldig utover lista.
  const sorted = withDates
    .map((p, i) => ({ ...p, originalIndex: i }))
    .sort((a, b) => {
      if (a.date && b.date) return b.date - a.date;
      if (a.date) return -1;
      if (b.date) return 1;
      return a.originalIndex - b.originalIndex;
    });

  const newBlock = `photos:\n${sorted.map((p) => `  - ${p.url}`).join('\n')}\n`;
  const updated = current.replace(/^photos:\n(?:[ \t]+-.*\n?)*/m, newBlock);

  await writeFile(OUT_PATH, updated);
  console.log(`Skrev ${sorted.length} bilde(r) i ny rekkefølge til ${OUT_PATH}`);
  console.log('Se over endringen, og commit + push den selv når du er fornøyd.');
}

main().catch((error) => {
  console.error('Feilet:', error.message);
  process.exit(1);
});
