import { createFileRoute } from '@tanstack/react-router'
import { getClient, getDb } from '@/server/db/client'

/** Liveness/readiness probe for the container platform. */
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await getDb()
          await getClient().execute('select 1')
          return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
        } catch {
          return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
        }
      },
    },
  },
})
