/**
 * Kontaktopplysninger som brukes flere steder. Lå tidligere skrevet ut i både
 * Header.astro og prints/[slug].astro — og hadde allerede rukket å drive fra
 * hverandre (én med punktum i adressen, én uten).
 */
export const SITE_EMAIL = 'gauteaalokken@gmail.com';

export const INSTAGRAM_HANDLE = 'sommerferiee';
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_HANDLE}`;

/** mailto med ferdig utfylt emnefelt, slik at en bestilling er lett å kjenne igjen i innboksen. */
export const mailtoWithSubject = (subject: string) =>
  `mailto:${SITE_EMAIL}?subject=${encodeURIComponent(subject)}`;
