export async function fetchWithRetry(src: string, attempts = 3): Promise<Buffer> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(src, { signal: controller.signal });
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Failed to fetch ${src}`);
}
