import { defineConfig } from 'vite';

const isPlaywright = process.env.PLAYWRIGHT_TEST === '1';

export default defineConfig({
  base: './',
  plugins: isPlaywright
    ? [
        {
          name: 'stub-vite-client-in-e2e',
          configureServer(server) {
            server.middlewares.use((req, res, next) => {
              const pathname = req.url?.split('?')[0];
              if (pathname !== '/@vite/client') return next();
              res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
              res.end(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.type = 'text/css';
    style.setAttribute('data-vite-dev-id', id);
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  }
  style.textContent = content;
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const noop = () => {};
  return { data: {}, accept: noop, acceptExports: noop, dispose: noop, prune: noop, decline: noop, invalidate: noop, on: noop, off: noop, send: noop };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return \`\${pathname}?\${queryToInject}\${search ? '&' + search.slice(1) : ''}\${hash || ''}\`;
}
export class ErrorOverlay extends HTMLElement {}
`);
            });
          },
        },
      ]
    : [],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PORT) || 5188,
    strictPort: false,
    ...(isPlaywright ? { watch: null } : {}),
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
