import { createFileRoute } from '@tanstack/react-router'
import { env } from '@/server/env'
import { safeEqual } from '@/server/crypto'
import { runDailyCleanup } from '@/server/jobs/cleanup'

/** POST /api/cron/cleanup with "Authorization: Bearer $CRON_SECRET" (call daily). */
export const Route = createFileRoute('/api/cron/cleanup')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = env().CRON_SECRET
        const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
        if (!secret || secret.length < 16 || !safeEqual(given, secret)) {
          return new Response('Forbidden', { status: 403 })
        }
        return Response.json(await runDailyCleanup())
      },
    },
  },
})
