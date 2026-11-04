import { createFileRoute } from '@tanstack/react-router'
import { PageIntro } from '@/components/ui/Editorial'

// Placeholder — replaced in Phase 2.
export const Route = createFileRoute('/$locale/admin/')({
  component: () => <PageIntro title="SOURA" />,
})
