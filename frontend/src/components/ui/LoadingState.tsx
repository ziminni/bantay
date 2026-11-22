import { Spinner } from './Button'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 px-6 py-12 text-sm text-gray-500">
      <Spinner />
      {label}
    </div>
  )
}
