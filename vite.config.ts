import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: { port: 3000 },
  build: {
    // Never inline fonts as data: URIs — the CSP only allows same-origin fonts.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
  },
  plugins: [
    tanstackStart(),
    nitro(),
    tailwindcss(),
    viteReact(),
  ],
})
