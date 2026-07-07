import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PORT) || 5188,
    strictPort: false,
  },
  preview: {
    host: '127.0.0.1',
    port: 4188,
    strictPort: true,
  },
  build: {
    // Sourcemaps are dev-only tooling weight — the Twitch upload doesn't need them,
    // and local debugging already has the dev server's own maps.
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
