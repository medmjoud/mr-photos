import { createFileRoute } from '@tanstack/react-router'
import { buildSitemap } from '@/server/sitemap'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () =>
        new Response(await buildSitemap(), {
          headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
        }),
    },
  },
})
