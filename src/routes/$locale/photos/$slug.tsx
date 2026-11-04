import { createFileRoute } from '@tanstack/react-router'
import { PageIntro } from '@/components/ui/Editorial'

// Placeholder — the photo page is built in Phase 3.
export const Route = createFileRoute('/$locale/photos/$slug')({
  component: () => <PageIntro title="SOURA" />,
})
