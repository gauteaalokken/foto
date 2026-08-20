import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Adressen til en fil i public/verktoy/, med et kort avtrykk av innholdet
 * hengt på: `/verktoy/grid.js?v=3f9a1c02`.
 *
 * Uten det kunne nettleseren servere en gammel kopi av verktøyet etter at du
 * hadde endret det — filnavnet var jo det samme — og endringen så ut til ikke
 * å ha skjedd. Avtrykket regnes ut ved bygging, så det endrer seg av seg selv
 * når fila endrer seg, og bare da. Du skal aldri måtte oppdatere et
 * versjonsnummer for hånd.
 *
 * Kjører bare ved bygging (Node), aldri i nettleseren.
 */
export function verktoyUrl(filnavn: string): string {
  const full = path.join(process.cwd(), 'public', 'verktoy', filnavn);
  const avtrykk = createHash('sha1').update(readFileSync(full)).digest('hex').slice(0, 8);

  return `/verktoy/${filnavn}?v=${avtrykk}`;
}
