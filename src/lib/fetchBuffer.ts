// CMS uploads with spaces in the original filename (e.g. "FFM 26 4_1.jpg") get
// saved with a literal, unencoded space in the URL. fetch() doesn't reliably
// error out on that — it can just hang until the timeout below fires on every
// retry — so this normalizes to a properly percent-encoded URL first.
// decodeURI+encodeURI (rather than encodeURI alone) keeps it idempotent for
// URLs that are already correctly encoded.
const normalizeUrl = (src: string) => {
  try {
    return encodeURI(decodeURI(src));
  } catch {
    return encodeURI(src);
  }
};

// Thrown for a response that arrived but wasn't a photo. Marked so the retry
// loop below can tell "this will never work" (404) apart from "try again"
// (503, connection reset).
class PermanentFetchError extends Error {}

export async function fetchWithRetry(src: string, attempts = 3): Promise<Buffer> {
  const url = normalizeUrl(src);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, { signal: controller.signal });

      // Without this, R2's 404 page — an HTML document — was handed to sharp
      // as if it were image bytes, and the build died on "Input buffer has
      // corrupt header: glib: XML parse error" without naming the photo. A
      // photo deleted from R2 while its URL is still in a YAML file is the
      // most likely build failure there is, so it gets to say so plainly.
      if (!res.ok) {
        const missing = res.status === 404;
        throw new PermanentFetchError(
          missing
            ? `Fant ikke bildet i R2 (HTTP 404): ${url}\n` +
              `  Bildet er slettet fra bøtta, men URL-en står fortsatt i en fil under src/content/.\n` +
              `  Fjern bildet i CMS-en på /admin og publiser, så går bygget gjennom.`
            : `R2 svarte HTTP ${res.status} for ${url}`
        );
      }

      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (error instanceof PermanentFetchError) throw error;
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Failed to fetch ${url}`);
}
