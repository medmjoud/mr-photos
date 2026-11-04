import { createFileRoute } from '@tanstack/react-router'
import { handleUpload } from '@/server/uploads'

export const Route = createFileRoute('/api/photos/upload')({
  server: {
    handlers: {
      POST: ({ request }) => handleUpload(request),
    },
  },
})
