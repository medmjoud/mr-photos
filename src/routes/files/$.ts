import { createFileRoute } from '@tanstack/react-router'
import { serveSignedFile } from '@/server/media'

export const Route = createFileRoute('/files/$')({
  server: {
    handlers: {
      GET: ({ params, request }) => serveSignedFile(params._splat ?? '', new URL(request.url)),
    },
  },
})
