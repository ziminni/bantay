import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

const tones: Record<BadgeTone, { pill: string; dot: string }> = {
  success: { pill: 'bg-emerald-50 text-emerald-800 ring-emerald-600/15', dot: 'bg-emerald-500' },
  danger: { pill: 'bg-red-50 text-red-800 ring-red-600/15', dot: 'bg-red-500' },
  warning: { pill: 'bg-marigold-50 text-marigold-800 ring-marigold-600/20', dot: 'bg-marigold-400' },
  info: { pill: 'bg-navy-50 text-navy-800 ring-navy-600/15', dot: 'bg-navy-500' },
  neutral: { pill: 'bg-gray-100 text-gray-600 ring-gray-500/15', dot: 'bg-gray-400' },
}

/**
 * A small pill for a state. Colour carries the meaning (green good, red
 * problem, marigold needs attention) and the text always says it too, so it
 * reads without colour.
 */
export function StatusBadge({
  children,
  tone = 'neutral',
  pulse = false,
  className,
  title,
}: {
  children: ReactNode
  tone?: BadgeTone
  /** Animate the dot, for live states such as an online camera. */
  pulse?: boolean
  className?: string
  title?: string
}) {
  const t = tones[tone]
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        t.pill,
        className,
      )}
    >
      <span aria-hidden className="relative flex size-1.5">
        {pulse && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', t.dot)} />}
        <span className={cn('relative inline-flex size-1.5 rounded-full', t.dot)} />
      </span>
      {children}
    </span>
  )
}
