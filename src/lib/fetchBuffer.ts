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

export async function fetchWithRetry(src: string, attempts = 3): Promise<Buffer> {
  const url = normalizeUrl(src);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Failed to fetch ${url}`);
}
