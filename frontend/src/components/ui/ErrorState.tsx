import { ApiError, errorMessage } from '@/api/errors'
import { Button } from './Button'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <p className="font-medium text-gray-900">{notFound ? 'Not found' : 'Could not load this'}</p>
      <p className="max-w-sm text-sm text-gray-500">{errorMessage(error)}</p>
      {onRetry && !notFound && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
