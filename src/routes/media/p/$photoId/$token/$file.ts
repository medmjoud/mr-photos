import { createFileRoute } from '@tanstack/react-router'
import { servePhotoMedia } from '@/server/media'

export const Route = createFileRoute('/media/p/$photoId/$token/$file')({
  server: {
    handlers: {
      GET: ({ params }) => servePhotoMedia(params.photoId, params.token, params.file),
    },
  },
})
