import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <EmptyState
      title="Page not found"
      description="The page you are looking for does not exist or was moved."
      action={
        <ButtonLink to="/" variant="primary">
          Go to the dashboard
        </ButtonLink>
      }
    />
  )
}
