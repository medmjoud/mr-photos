import { createFileRoute } from '@tanstack/react-router'
import { PageIntro } from '@/components/ui/Editorial'

// Placeholder — replaced in a later build phase.
export const Route = createFileRoute('/$locale/privacy')({
  component: () => <PageIntro title="SOURA" />,
})
