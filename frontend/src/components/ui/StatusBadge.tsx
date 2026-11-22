import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * A small label for a state. With no colour design yet, states are told apart
 * by their text and by a filled (on) or hollow (off) dot.
 */
export function StatusBadge({
  children,
  on = true,
  muted = false,
  className,
  title,
}: {
  title?: string
  children: ReactNode
  on?: boolean
  muted?: boolean
  className?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        muted ? 'border-gray-200 text-gray-500' : 'border-gray-300 text-gray-800',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('size-2 rounded-full border border-current', on ? 'bg-current' : 'bg-transparent')}
      />
      {children}
    </span>
  )
}
