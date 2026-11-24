import { RefreshCw, SearchX, WifiOff } from 'lucide-react'
import { ApiError, errorMessage } from '@/api/errors'
import { Button } from './Button'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404
  const Icon = notFound ? SearchX : WifiOff
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100">
        <Icon className="size-6" />
      </div>
      <p className="font-display text-base font-semibold text-navy-900">{notFound ? 'Not found' : 'Could not load this'}</p>
      <p className="max-w-sm text-sm text-gray-500">{errorMessage(error)}</p>
      {onRetry && !notFound && (
        <Button size="sm" onClick={onRetry} icon={<RefreshCw />} className="mt-2">
          Try again
        </Button>
      )}
    </div>
  )
}
