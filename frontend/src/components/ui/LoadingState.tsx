import { BrandMark } from '@/components/brand/BrandMark'

/** The Bantay eye, gently pulsing, while something loads. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-sm text-gray-500">
      <BrandMark className="size-9 animate-pulse" />
      {label}
    </div>
  )
}

/** Grey placeholder blocks shaped like the content that is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-gray-100 ${className ?? ''}`} />
}
