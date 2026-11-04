import { createFileRoute } from '@tanstack/react-router'
import { PageIntro } from '@/components/ui/Editorial'

// Placeholder — profile editing is built in Phase 3.
export const Route = createFileRoute('/$locale/dashboard/profile')({
  component: () => <PageIntro title="SOURA" />,
})
