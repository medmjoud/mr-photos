import { createFileRoute } from '@tanstack/react-router'
import { handleAvatarUpload } from '@/server/avatars'

export const Route = createFileRoute('/api/profile/avatar')({
  server: { handlers: { POST: ({ request }) => handleAvatarUpload(request) } },
})
