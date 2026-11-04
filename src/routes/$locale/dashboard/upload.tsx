import { createFileRoute } from '@tanstack/react-router'
import { PageIntro } from '@/components/ui/Editorial'

// Placeholder — replaced in Phase 2.
export const Route = createFileRoute('/$locale/dashboard/upload')({
  component: () => <PageIntro title="SOURA" />,
})
