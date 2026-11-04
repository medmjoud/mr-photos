import { defineConfig, type Plugin } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

/**
 * Dev only: Vite's dev server answers requests ending in a file extension
 * itself (404 for unknown files). Media and signed-file routes are served by
 * TanStack server routes, so route them past Vite's asset handling.
 */
function devServerRoutes(): Plugin {
  return {
    name: 'soura:dev-server-routes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith('/media/') || req.url?.startsWith('/files/')) req.headers['sec-fetch-dest'] = 'document'
        next()
      })
    },
  }
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: { port: 3000 },
  build: {
    // Never inline fonts as data: URIs — the CSP only allows same-origin fonts.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
  },
  plugins: [
    devServerRoutes(),
    tanstackStart(),
    // Pre-compress static assets (gzip + brotli); dynamic responses are gzipped in src/start.ts.
    nitro({ compressPublicAssets: { gzip: true, brotli: true } }),
    tailwindcss(),
    viteReact(),
  ],
})
