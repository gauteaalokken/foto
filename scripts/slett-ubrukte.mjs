#!/usr/bin/env node
/**
 * ENGANGSJOBB SOM ALLEREDE ER KJØRT — 2026-08-13. Ligger her som kvittering
 * på hva som ble ryddet bort, ikke som et verktøy til gjenbruk.
 *
 * Den slettet de 113 filene under fra R2-bøtta "foto-photos" fordi ingen av
 * dem var i bruk på nettsiden. Alle svarer 404 i dag; kjører du den på nytt,
 * skjer det ingenting.
 *
 * ⚠️ LISTA ER FROSSEN, IKKE EN SJEKK. Den ble skrevet ut fra innholdet i
 * repoet den dagen. Laster du senere opp et bilde med et av de samme
 * filnavnene, vil et nytt kjør slette det bildet også — selv om det er i
 * bruk. Skal ubrukte filer ryddes igjen, må lista lages på nytt først.
 *
 * Tørrkjøring (viser lista, sletter ingenting):
 *     node scripts/slett-ubrukte.mjs
 *
 * Faktisk sletting:
 *     node scripts/slett-ubrukte.mjs --slett
 *
 * Krever .env.local med R2_SECRET_ACCESS_KEY, og at du står i prosjektmappa.
 * Slettingen er PERMANENT. R2 har ingen papirkurv.
 */
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';

process.loadEnvFile?.('.env.local');

const SECRET = process.env.R2_SECRET_ACCESS_KEY;
if (!SECRET) {
  console.error('Mangler R2_SECRET_ACCESS_KEY. Kjør fra prosjektmappa, med .env.local til stede.');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: 'https://1904e782382751217d6103b2d39a41da.r2.cloudflarestorage.com',
  credentials: { accessKeyId: 'a74d879decb219fc298c10edd12ecda5', secretAccessKey: SECRET },
});

const BUCKET = 'foto-photos';
const KEYS = [
  "DSCF1333.jpg",
  "DSCF1374.jpg",
  "DSCF1390.jpg",
  "DSCF1427.jpg",
  "DSCF1572.jpg",
  "DSCF1665.jpg",
  "DSCF1711.jpg",
  "DSCF1749.jpg",
  "DSCF2002.jpg",
  "DSCF2125.jpg",
  "DSCF2136.jpg",
  "DSCF2201.jpg",
  "DSCF2214.jpg",
  "DSCF2260.jpg",
  "DSCF2562.jpg",
  "DSCF2566.jpg",
  "DSCF3033.jpg",
  "DSCF3615.jpg",
  "DSCF4421-Forbedret-NR.jpg",
  "DSCF4547.jpg",
  "DSCF4802.jpg",
  "DSCF5024.jpg",
  "DSCF5044.jpg",
  "DSCF5085.jpg",
  "DSCF5108.jpg",
  "DSCF5170.jpg",
  "DSCF5233.jpg",
  "DSCF5298.jpg",
  "DSCF5462.jpg",
  "DSCF5476.jpg",
  "DSCF5479.jpg",
  "DSCF5565.jpg",
  "DSCF5638.jpg",
  "DSCF5645.jpg",
  "DSCF5889.jpg",
  "DSCF6063.jpg",
  "DSCF6419.jpg",
  "DSCF6700.jpg",
  "DSCF6819.jpg",
  "DSCF7052.jpg",
  "DSCF7117.jpg",
  "DSCF7142.jpg",
  "DSCF7206.jpg",
  "DSCF7210.jpg",
  "DSCF7250-2.jpg",
  "DSCF7250.jpg",
  "DSCF7271.jpg",
  "DSCF7289.jpg",
  "DSCF7418.jpg",
  "DSCF7532.jpg",
  "DSCF7543.jpg",
  "DSCF7561.jpg",
  "DSCF7850.jpg",
  "DSCF8038.jpg",
  "DSCF8066.jpg",
  "DSCF8113.jpg",
  "DSCF8173.jpg",
  "DSCF8417.jpg",
  "DSCF8543.jpg",
  "DSCF8560.jpg",
  "DSCF8563.jpg",
  "DSCF8760.jpg",
  "DSCF8865.jpg",
  "DSCF8875.jpg",
  "DSCF8907.jpg",
  "DSCF8962.jpg",
  "GAUT7670.jpg",
  "R1-08465-0018.jpg",
  "fjellmaraton/FFM 26.jpg",
  "homepage/DSCF0026.jpg",
  "homepage/DSCF0036.jpg",
  "homepage/DSCF0051.jpg",
  "homepage/DSCF0093.jpg",
  "homepage/DSCF0131.jpg",
  "homepage/DSCF0322.jpg",
  "homepage/DSCF0387.jpg",
  "homepage/DSCF0408.jpg",
  "homepage/DSCF0483.jpg",
  "homepage/DSCF0516.jpg",
  "homepage/DSCF0651.jpg",
  "homepage/DSCF0658.jpg",
  "homepage/DSCF0730.jpg",
  "homepage/DSCF0795.jpg",
  "homepage/DSCF0865.jpg",
  "homepage/DSCF1112.jpg",
  "homepage/DSCF1124.jpg",
  "homepage/DSCF1127.jpg",
  "homepage/DSCF1145.jpg",
  "homepage/DSCF1175.jpg",
  "homepage/DSCF1183.jpg",
  "homepage/DSCF1195.jpg",
  "homepage/DSCF1219.jpg",
  "homepage/DSCF1237.jpg",
  "homepage/DSCF1294.jpg",
  "prints/Prints til salg_10.jpg",
  "projects/DSCF0408.jpg",
  "projects/DSCF1112.jpg",
  "projects/DSCF1427.jpg",
  "projects/DSCF3033.jpg",
  "projects/DSCF3615.jpg",
  "projects/DSCF4421-Forbedret-NR.jpg",
  "projects/GAUT5016.jpg",
  "projects/GAUT5022.jpg",
  "projects/GAUT5031.jpg",
  "projects/GAUT5052.jpg",
  "projects/GAUT5067.jpg",
  "projects/GAUT5157.jpg",
  "projects/GAUT5200.jpg",
  "projects/GAUT5238.jpg",
  "projects/GAUT5244.jpg",
  "projects/GAUT5431.jpg",
  "projects/GAUT5440.jpg",
  "projects/GAUT5442.jpg"
];

const doDelete = process.argv.includes('--slett');

if (!doDelete) {
  console.log(`TØRRKJØRING — ingenting slettes.\n${KEYS.length} filer ville blitt slettet:\n`);
  for (const k of KEYS) console.log('  ' + k);
  console.log('\nKjør med --slett for å gjennomføre.');
  process.exit(0);
}

console.log(`Sletter ${KEYS.length} filer fra ${BUCKET}...`);

let slettet = 0, feilet = 0;
for (let i = 0; i < KEYS.length; i += 100) {
  const batch = KEYS.slice(i, i + 100);
  const res = await s3.send(new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: { Objects: batch.map((Key) => ({ Key })) },
  }));
  slettet += (res.Deleted ?? []).length;
  for (const e of res.Errors ?? []) {
    feilet++;
    console.error('  FEIL:', e.Key, '-', e.Message);
  }
}

console.log(`\nFerdig. Slettet ${slettet}, feilet ${feilet}.`);
console.log('Sjekk at nettsiden fortsatt virker: https://gauteaalokken.com');
