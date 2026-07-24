export async function fetchWithRetry(src: string, attempts = 3): Promise<Buffer> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(src);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (attempt === attempts) throw error;
    }
  }

  throw new Error(`Failed to fetch ${src}`);
}
