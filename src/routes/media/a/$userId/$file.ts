import { createFileRoute } from '@tanstack/react-router'
import { serveAvatar } from '@/server/media'

export const Route = createFileRoute('/media/a/$userId/$file')({
  server: {
    handlers: {
      GET: ({ params }) => serveAvatar(params.userId, params.file),
    },
  },
})
