import { defineConfig } from 'astro/config';
import { setGlobalDispatcher, Agent } from 'undici';

// Astro's own remote-image fetching (used by getImage() for R2-hosted photos)
// has no timeout, so a single stalled connection can hang the build forever.
// Bounding every outgoing request process-wide turns that into a fast,
// retryable failure instead of an indefinite CI hang.
setGlobalDispatcher(new Agent({
  connectTimeout: 20_000,
  headersTimeout: 20_000,
  bodyTimeout: 20_000,
}));

export default defineConfig({
  site: 'https://gauteaalokken.com',
  image: {
    remotePatterns: [{ protocol: 'https', hostname: 'pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev' }],
  },
});
