import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://gauteaalokken.github.io',
  base: '/foto',
  image: {
    remotePatterns: [{ protocol: 'https', hostname: 'pub-3870a4bde8aa48ebb61d76487f736f57.r2.dev' }],
  },
});
