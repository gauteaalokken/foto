import { fileURLToPath } from 'node:url';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'astro/config';
import { setGlobalDispatcher, Agent } from 'undici';
import { MANIFEST_FILENAME, STAGING_DIR, readManifest, resetManifest } from './src/lib/imageOutputQueue.ts';

// Astro's own remote-image fetching (used by getImage() for R2-hosted photos)
// has no timeout, so a single stalled connection can hang the build forever.
// Bounding every outgoing request process-wide turns that into a fast,
// retryable failure instead of an indefinite CI hang.
setGlobalDispatcher(new Agent({
  connectTimeout: 20_000,
  headersTimeout: 20_000,
  bodyTimeout: 20_000,
}));

// The homepage resizes its own remote photos with sharp and stages the bytes
// on disk (see src/lib/imageOutputQueue.ts) instead of writing them into
// public/ or dist/ during page rendering, since Astro copies/clears those
// directories at points outside our control. This staging directory is kept
// (not wiped) between builds and restored via actions/cache in CI, so a photo
// already resized in a previous build is reused instead of re-fetched from
// R2 and re-resized from scratch every time — that used to make every build,
// even ones that didn't touch any photos, redo all the same work.
const flushStagedImages = {
  name: 'flush-staged-images',
  hooks: {
    'astro:build:start': async () => {
      await resetManifest();
    },
    'astro:build:done': async ({ dir }) => {
      const outDir = path.join(fileURLToPath(dir), 'optimized');
      const referenced = await readManifest();

      if (referenced.size > 0) {
        await mkdir(outDir, { recursive: true });
        await Promise.all(
          Array.from(referenced).map(async (filename) => {
            const buffer = await readFile(path.join(STAGING_DIR, filename)).catch(() => null);
            if (buffer) await writeFile(path.join(outDir, filename), buffer);
          })
        );
      }

      // Prune anything left in the cache that this build didn't reference
      // (e.g. a photo removed from the CMS), so the cache doesn't grow forever.
      const staged = await readdir(STAGING_DIR).catch(() => []);
      await Promise.all(
        staged
          .filter((filename) => filename !== MANIFEST_FILENAME && !referenced.has(filename))
          .map((filename) => rm(path.join(STAGING_DIR, filename), { force: true }))
      );
    },
    // astro:build:* hooks never fire for `astro dev` — without this, every
    // staged photo 404s in local dev since nothing else serves them.
    // Vite's dev server already strips the configured base path before
    // requests reach middleware registered here, so this matches un-prefixed paths.
    'astro:server:setup': ({ server }) => {
      const prefix = '/optimized/';

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(prefix)) return next();

        const filename = req.url.slice(prefix.length).split('?')[0];

        try {
          const buffer = await readFile(path.join(STAGING_DIR, filename));
          res.setHeader('Content-Type', 'image/webp');
          res.end(buffer);
        } catch {
          next();
        }
      });
    },
  },
};

export default defineConfig({
  site: 'https://gauteaalokken.com',
  image: {
    remotePatterns: [{ protocol: 'https', hostname: 'pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev' }],
  },
  integrations: [flushStagedImages],
});
